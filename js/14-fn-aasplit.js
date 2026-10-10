// Largest remainder: chia nguyên `total` theo weights (mảng số ≥0); tổng weights = 0 → chia bằng nhau
function _aaSplit(total, weights){
  var n = weights.length, out = new Array(n).fill(0);
  total = Math.max(0, Math.floor(total) || 0);
  if (!n || !total) return out;
  var w = weights.map(function(x){ return Math.max(0, Number(x) || 0); });
  var sum = w.reduce(function(a,b){ return a+b; }, 0);
  if (sum <= 0) { w = w.map(function(){ return 1; }); sum = n; }
  var raw = w.map(function(x){ return total * x / sum; });
  var fl = raw.map(Math.floor), used = fl.reduce(function(a,b){ return a+b; }, 0);
  var order = raw.map(function(_,i){ return i; }).sort(function(a,b){ return (raw[b]-fl[b]) - (raw[a]-fl[a]) || a-b; });
  for (var k = 0; k < total - used; k++) fl[order[k % n]]++;
  return fl;
}
// Lấy tỷ lệ áp dụng cho 1 người: ghi đè người → ghi đè Team → chung
function _aaRatioFor(cfg, kind, tid, name){
  var mk = { src:'memberSrc', prio:'memberPrio', hang:'memberHang' }[kind], tk = { src:'teamSrc', prio:'teamPrio', hang:'teamHang' }[kind];
  var m = cfg[mk] && cfg[mk][tid] && cfg[mk][tid][name]; if (m) return m;
  var t = cfg[tk] && cfg[tk][tid]; if (t) return t;
  return cfg[kind];
}
function _aaWeights(ratio, keys){   // chỉ lấy khoá được cài > 0; nếu chưa cài gì → tất cả khoá bằng nhau
  var vals = (ratio && ratio.vals) || {};
  var w = keys.map(function(k){ return Math.max(0, Number(vals[k]) || 0); });
  if (w.every(function(x){ return x === 0; })) w = keys.map(function(){ return 1; });
  return w;
}
// Danh sách người nhận + hạn mức/ngày. teamsArr = mảng team {id,name,members[],leader}; membersOf(team) → danh sách tên
function _aaRecipients(cfg, teamsArr, membersOf){
  var list = [], warn = [];
  (teamsArr || []).forEach(function(t){
    var tc = cfg.teams[t.id]; if (!tc || !tc.on) return;
    var members = membersOf(t); if (!members.length) { warn.push('Team "'+t.name+'" chưa có thành viên'); return; }
    var mc = (cfg.members && cfg.members[t.id]) || {};
    var mm = (cfg.memberMode && cfg.memberMode[t.id]) || 'pct';
    var active = members.filter(function(m){ return !mc[m] || mc[m].on !== false; });   // mặc định tích (chưa cài = có chia)
    if (!active.length) return;
    var teamQuota = tc.mode === 'pct' ? Math.round((cfg.dailyTotal || 0) * (Number(tc.val) || 0) / 100) : Math.floor(Number(tc.val) || 0);
    var q;
    if (mm === 'count') q = active.map(function(m){ return Math.max(0, Math.floor(Number((mc[m]||{}).val) || 0)); });
    else q = _aaSplit(teamQuota, active.map(function(m){ return Number((mc[m]||{}).val) || 0; }));
    active.forEach(function(m, i){ if (q[i] > 0) list.push({ team:t.id, teamName:t.name, name:m, quota:q[i] }); });
  });
  return { list:list, warn:warn };
}
// Dựng nhóm ứng viên theo (nguồn, ưu tiên). custs: [{phone,dataSrc,tier}] ; everSet: Set SĐT đã chia từng
function _aaBuckets(cfg, custs, everSet){
  var b = {}, bh = {};   // b[s][p] = [phone] (nhu cu) ; bh['s|p|h'] = [phone] -- them chieu PHAN HANG KH (doanh thu): thuong|tt|vip|super
  _AA_SRC_KEYS.forEach(function(s){ b[s] = {}; _AA_PRIO_KEYS.forEach(function(p){ b[s][p] = []; _AA_HANG_KEYS.forEach(function(h){ bh[s+'|'+p+'|'+h] = []; }); }); });
  for (var i = 0; i < custs.length; i++){
    var c = custs[i]; if (!c || !c.phone) continue;
    if (cfg.onlyUnassigned && everSet && everSet.has(c.phone)) continue;
    var p = c.tier === 'VIP' ? 'vip' : c.tier === 'Thân thiết' ? 'tt' : c.tier === 'Tiềm năng' ? 'tn' : 'other';
    var hg = (c.hangKey && _AA_HANG_KEYS.indexOf(c.hangKey) >= 0) ? c.hangKey : 'thuong';
    var d = c.dataSrc || {};
    for (var j = 0; j < _AA_SRC_KEYS.length; j++){ var s = _AA_SRC_KEYS[j]; if (d[s]) { b[s][p].push(c.phone); bh[s+'|'+p+'|'+hg].push(c.phone); } }
  }
  b._h = bh;
  return b;
}
// Lập kế hoạch 1 ngày. Trả {entries:[{team,teamName,name,phones[]}], short:[{name,missing}], warn:[]}
function _aaPlan(cfg, teamsArr, membersOf, custs, everSet, taken0){
  var rc = _aaRecipients(cfg, teamsArr, membersOf), buckets = _aaBuckets(cfg, custs, everSet);
  var taken = taken0 || new Set(), ptr = {}, entries = [], short = [];
  function take(s, p, n, out, h){         // lay toi da n SDT chua dung tu nhom (s,p) [va hang h neu co]
    var arr = h ? buckets._h[s + '|' + p + '|' + h] : buckets[s][p], k = s + '|' + p + (h ? '|' + h : ''), got = 0, i = ptr[k] || 0;
    while (got < n && i < arr.length){ var ph = arr[i++]; if (!taken.has(ph)) { taken.add(ph); out.push(ph); got++; } }
    ptr[k] = i; return got;
  }
  rc.list.forEach(function(r){
    var sw = _aaWeights(_aaRatioFor(cfg, 'src', r.team, r.name), _AA_POS_KEYS);
    var sq = _aaSplit(r.quota, sw), phones = [], miss = 0;
    var pw = _aaWeights(_aaRatioFor(cfg, 'prio', r.team, r.name), _AA_PRIO_KEYS);
    var srcOrder = _AA_POS_KEYS.map(function(s,i){ return { s:s, w:sw[i] }; }).filter(function(x){ return x.w > 0; })
      .sort(function(a,b){ return b.w - a.w; }).map(function(x){ return x.s; });
    var prOrder = _AA_PRIO_KEYS.map(function(p,i){ return { p:p, w:pw[i] }; }).filter(function(x){ return x.w > 0; })
      .sort(function(a,b){ return b.w - a.w; }).map(function(x){ return x.p; });
    // Phan hang KH (doanh thu): CHI kich hoat khi co it nhat 1 hang duoc cai > 0 (chua cai = giu nguyen cach chia cu, khong doi hanh vi)
    var hr = _aaRatioFor(cfg, 'hang', r.team, r.name), hv = (hr && hr.vals) || {};
    var hangOn = _AA_HANG_KEYS.some(function(k){ return (Number(hv[k]) || 0) > 0; });
    if (hangOn){
      // Chia han muc theo HANG truoc (tong moi hang dung ty le), ben trong moi hang van chia theo ty le NGUON roi UU TIEN nhu cu.
      var hq = _aaSplit(r.quota, _aaWeights(hr, _AA_HANG_KEYS));
      _AA_HANG_KEYS.forEach(function(h, hi){
        if (!hq[hi]) return;
        var m = 0, sqh = _aaSplit(hq[hi], sw);
        _AA_POS_KEYS.forEach(function(s, si){
          if (!sqh[si]) return;
          var pqh = _aaSplit(sqh[si], pw);
          _AA_PRIO_KEYS.forEach(function(p, pi){
            if (!pqh[pi]) return;
            var g = take(s, p, pqh[pi], phones, h);
            if (g < pqh[pi]) m += pqh[pi] - g;
          });
        });
        // o (nguon,uu tien) nao thieu dung hang nay -> lay hang do o cac o khac (nguon/uu tien trong so cao truoc)
        for (var a = 0; a < srcOrder.length && m > 0; a++)
          for (var c2 = 0; c2 < prOrder.length && m > 0; c2++) m -= take(srcOrder[a], prOrder[c2], m, phones, h);
        miss += Math.max(0, m);
      });
    } else {
      _AA_POS_KEYS.forEach(function(s, si){
        if (!sq[si]) return;
        var pq = _aaSplit(sq[si], pw);
        _AA_PRIO_KEYS.forEach(function(p, pi){
          if (!pq[pi]) return;
          var got = take(s, p, pq[pi], phones);
          if (got < pq[pi]) miss += pq[pi] - got;
        });
      });
    }
    if (miss > 0){   // bu: cung nguon da chon truoc (theo uu tien co trong so cao), roi cac nguon con lai co trong so > 0 (bu KHONG phan biet hang)
      for (var a = 0; a < srcOrder.length && miss > 0; a++)
        for (var c2 = 0; c2 < prOrder.length && miss > 0; c2++) miss -= take(srcOrder[a], prOrder[c2], miss, phones);
    }
    if (miss > 0) short.push({ name:r.name, team:r.teamName, missing:miss, quota:r.quota });
    if (phones.length) entries.push({ team:r.teamName, teamId:r.team, name:r.name, phones:phones, quota:r.quota });
  });
  return { entries:entries, short:short, warn:rc.warn };
}
// CSKH-Duyen chia RIENG: moi nguoi 1 han muc CSKH/ngay (cung kieu Team/thanh vien nhu POS), lay lan luot tu danh sach KH nguon CSKH-Duyen
// (khong chia theo nguon/uu tien/hang). `taken` dung chung voi POS de 1 SDT khong bi chia 2 lan trong cung 1 ngay.
function _aaPlanCskh(cfg, teamsArr, membersOf, custs, everSet, taken){
  var c2 = { teams: cfg.cskhTeams || {}, dailyTotal: cfg.cskhTotal || 0, memberMode: cfg.cskhMemberMode || {}, members: cfg.cskhMembers || {} };
  var rc = _aaRecipients(c2, teamsArr, membersOf), pool = [], entries = [], short = [], ptr = 0;
  for (var i = 0; i < custs.length; i++){
    var c = custs[i]; if (!c || !c.phone || !(c.dataSrc && c.dataSrc.cskh)) continue;
    if (cfg.onlyUnassigned && everSet && everSet.has(c.phone)) continue;
    pool.push(c.phone);
  }
  rc.list.forEach(function(r){
    var phones = [];
    while (phones.length < r.quota && ptr < pool.length){ var ph = pool[ptr++]; if (!taken.has(ph)) { taken.add(ph); phones.push(ph); } }
    if (phones.length < r.quota) short.push({ name:r.name, team:r.teamName, missing:r.quota - phones.length, quota:r.quota, src:'cskh' });
    if (phones.length) entries.push({ team:r.teamName, teamId:r.team, name:r.name, phones:phones, quota:r.quota, src:'cskh' });
  });
  return { entries:entries, short:short, warn:rc.warn.map(function(w){ return '[CSKH] ' + w; }) };
}
// Ke hoach ca ngay = CSKH (rieng) + POS (tu dt/don/cs). opts: {pos:bool, cskh:bool} (mac dinh ca hai). CSKH lap truoc de han muc CSKH khong bi POS lay mat KH.
function _aaPlanAll(cfg, teamsArr, membersOf, custs, everSet, opts){
  custs = (custs || []).filter(function(c){ return c && isValidVnPhone(c.phone); });   // chỉ chia SĐT di động VN hợp lệ
  opts = opts || {}; var taken = new Set(), out = { entries:[], short:[], warn:[] };
  if (opts.cskh !== false){
    var k = _aaPlanCskh(cfg, teamsArr, membersOf, custs, everSet, taken);
    out.entries = out.entries.concat(k.entries); out.short = out.short.concat(k.short); out.warn = out.warn.concat(k.warn);
  }
  if (opts.pos !== false){
    var p = _aaPlan(cfg, teamsArr, membersOf, custs, everSet, taken);
    p.entries.forEach(function(e){ e.src = 'pos'; }); p.short.forEach(function(x){ x.src = 'pos'; });
    out.entries = out.entries.concat(p.entries); out.short = out.short.concat(p.short); out.warn = out.warn.concat(p.warn);
  }
  return out;
}

function _aaDayOn(cfg, d){ d = d || new Date(); return (cfg.days || []).indexOf(d.getDay()) >= 0; }
function _aaToday(d){ d = d || new Date(); var p = function(n){ return String(n).padStart(2,'0'); }; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }

// Cấu hình (UI ghi) và TRẠNG THÁI chạy (lastRun/lastResult — chỉ người chạy ghi) lưu 2 key Settings riêng, để lưu cấu hình
// không bao giờ ghi đè lastRun cũ → tránh server/trình duyệt chia lại lần 2 trong ngày.
function _aaPostSetting(key, obj){
  if (!gsUrl) return Promise.resolve();
  return fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:key, value: JSON.stringify(obj) }) }).catch(function(e){ console.warn('[AutoAssign] lưu '+key+' lỗi', e); });
}
function _aaPersist(){
  saveLS('ome_auto_assign_cfg', _aaCfg);
  var out = Object.assign({}, _aaCfg); delete out.lastRun; delete out.lastResult;
  out.teamMembers = {}; (teams || []).forEach(function(t){ out.teamMembers[t.id] = _aaMembersOf(t); });   // server dùng đúng danh sách người nhận như UI
  return _aaPostSetting('autoAssignCfg', out);
}
function _aaPersistState(by){ return _aaPostSetting('autoAssignState', { lastRun:_aaCfg.lastRun || '', lastResult:_aaCfg.lastResult || null, by:by || 'browser' }); }
async function _aaPullCfg(){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=autoAssignCfg', { redirect:'follow' });
    var j = await r.json();
    var keep = { lastRun:_aaCfg.lastRun, lastResult:_aaCfg.lastResult };
    if (j && j.value) { _aaCfg = Object.assign(_aaDefaultCfg(), JSON.parse(j.value), keep); }
    var r2 = await fetch(gsUrl + '?action=getSetting&key=autoAssignState', { redirect:'follow' });
    var j2 = await r2.json();
    if (j2 && j2.value) { var st = JSON.parse(j2.value); _aaCfg.lastRun = st.lastRun || ''; _aaCfg.lastResult = st.lastResult || null; _aaCfg.lastBy = st.by || ''; }
    saveLS('ome_auto_assign_cfg', _aaCfg);
  } catch(e) { console.warn('[AutoAssign] nạp cấu hình lỗi', e); }
}
function _aaMembersOf(t){ return (typeof _teamMembersList === 'function') ? _teamMembersList(t) : (t.members || []); }
// Xem trước kế hoạch hôm nay (KHÔNG ghi gì)
function _aaPreview(opts){ return _aaPlanAll(_aaCfg, teams, _aaMembersOf, allCustomers, _everAssignedSet(), opts); }

// Chạy chia thật: ghi lịch sử + cập nhật CS chăm sóc giống hệt luồng chia thủ công (doAssignDataAdvanced)
function _aaCommit(plan, tag){
  var now = new Date().toISOString().slice(0,16).replace('T',' '), dm = _aaToday().slice(8) + '/' + _aaToday().slice(5,7);
  var entries = plan.entries.map(function(e){
    var en = { id: Date.now().toString() + '_' + Math.random().toString(36).slice(2,6), date: now, csName: e.name, phones: e.phones,
      label: (tag || 'Tự động ' + dm) + (e.src === 'cskh' ? ' CSKH-Duyên' : '') + ' — ' + e.team + ' → ' + e.name + ' (' + e.phones.length + ' KH)', team: e.team, auto: true, donePhones: [] };
    assignHistory.unshift(en); return en;
  });
  if (!entries.length) return entries;
  saveLS('ome_assign_hist', assignHistory);
  _invalidateFilterCache();
  if (typeof _rebuildAssignIndex === 'function') _rebuildAssignIndex();
  try { _applyCareCSToAssigned(entries); } catch(e){ console.warn('applyCareCSToAssigned lỗi:', e); }
  entries.forEach(function(e){ logAudit('assign', '', '', 'Tự động ' + e.team + ': ' + e.phones.length + ' KH → ' + e.csName); });
  try { if (gsUrl) (async function(){ for (var i = 0; i < entries.length; i++) await pushAssignToGS(entries[i]); })(); } catch(e){ console.warn('pushAssignToGS lỗi:', e); }
  if (typeof updateMyDataBadge === 'function') updateMyDataBadge();
  return entries;
}
// force=true: chạy ngay (nút "Chạy thử hôm nay" — bỏ qua lastRun & công tắc ngày). Tự động: chỉ chạy khi bật + hôm nay được tích + chưa chạy hôm nay.
async function _aaRunIfDue(force){
  // force (nút Chạy ngay) → trả {error:'lý do cụ thể'} để UI báo đúng; chạy tự động nền vẫn im lặng (null)
  var fail = function(msg){ return force ? { error: msg } : null; };
  if (_aaBusy) return fail('Đang có lượt chia khác chạy dở — đợi vài giây rồi bấm lại.');
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin') return fail('Chỉ tài khoản admin mới được chia.');
  if (!allCustomers || !allCustomers.length) return fail('Dữ liệu khách hàng chưa tải xong — đợi trang tải xong rồi bấm lại.');
  if (!teams || !teams.length) return fail('Chưa có Team nào — tạo ở tab Quản lý Team trước.');
  _aaBusy = true;
  var stage = 'đọc cấu hình từ server';   // báo đúng bước nào lỗi (trước đây lỗi bị nuốt thành 1 câu chung)
  try {
    await _aaPullCfg();   // lấy bản mới nhất (máy admin khác có thể vừa chạy hôm nay)
    var today = _aaToday();
    var posOk = !!_aaCfg.enabled && _aaDayOn(_aaCfg), cskhOk = !!_aaCfg.cskhEnabled && (_aaCfg.cskhDays || []).indexOf(new Date().getDay()) >= 0;   // POS và CSKH-Duyên có công tắc + ngày RIÊNG
    if (!force && ((!posOk && !cskhOk) || _aaCfg.lastRun === today || new Date().getHours() < (parseInt(_aaCfg.runHour) || 0))) return null;
    // Đánh dấu ĐÃ CHẠY hôm nay trước khi chia → 2 máy admin cùng mở không chia đôi 2 lần
    if (!force) { _aaCfg.lastRun = today; await _aaPersistState('browser'); }
    stage = 'lập kế hoạch chia (đọc danh sách KH / Team / tỷ lệ)';
    var plan = _aaPreview(force ? {} : { pos: posOk, cskh: cskhOk });
    stage = 'ghi lịch sử chia + cập nhật CS';
    var entries = _aaCommit(plan, force ? 'Chạy thử' : null);
    stage = 'lưu kết quả lần chạy';
    var total = entries.reduce(function(s,e){ return s + e.phones.length; }, 0);
    _aaCfg.lastResult = { date: today, total: total, people: entries.length, short: plan.short, warn: plan.warn, forced: !!force, by: 'browser' };
    await _aaPersistState(force ? 'browser-force' : 'browser');
    if (typeof toast === 'function') toast(total ? '⏰ Chia tự động: ' + total + ' KH → ' + entries.length + ' CS' + (plan.short.length ? ' (có ' + plan.short.length + ' người thiếu data)' : '') : '⏰ Chia tự động: không có KH nào để chia (kiểm tra cấu hình/nguồn)');
    return { plan: plan, total: total, entries: entries, forced: !!force };
  } catch(e) { console.error('[AutoAssign] lỗi ở bước "' + stage + '"', e); return fail('Lỗi ở bước "' + stage + '": ' + (e && e.message ? e.message : e) + ' (F12 → Console để xem chi tiết).'); }
  finally { _aaBusy = false; }
}
function _aaScopeObj(kind, tid, name, create){
  if (!tid) return _aaCfg[kind];
  var key = ({ src:['teamSrc','memberSrc'], prio:['teamPrio','memberPrio'], hang:['teamHang','memberHang'] })[kind][name ? 1 : 0];
  var root = _aaCfg[key] = _aaCfg[key] || {};
  if (!name) { if (!root[tid] && create) root[tid] = { mode:'pct', vals:{} }; return root[tid]; }
  root[tid] = root[tid] || {};
  if (!root[tid][name] && create) root[tid][name] = { mode:'pct', vals:{} };
  return root[tid][name];
}
function _aaRerender(){ var b = document.getElementById('assign-body'), st = b ? b.scrollTop : 0; renderAssignAuto(); if (b) b.scrollTop = st; }
function _aaSet(path, v, rerender){   // path: 'enabled' | 'dailyTotal' | 'onlyUnassigned' | 'runHour'
  _aaCfg[path] = (typeof v === 'boolean') ? v : ((path === 'dailyTotal' || path === 'cskhTotal') ? Math.max(0, parseInt(v) || 0) : path === 'runHour' ? Math.min(23, Math.max(0, parseInt(v) || 0)) : v);
  if (rerender !== false) _aaRerender();
  if (path === 'enabled' || path === 'cskhEnabled') _aaPersist();
}
function _aaToggleDay(d){
  d = parseInt(d); var a = _aaCfg.days || [], i = a.indexOf(d);
  if (i >= 0) a.splice(i, 1); else a.push(d);
  _aaCfg.days = a; _aaRerender();
}
function _aaTeamCfg(tid){ if (!_aaCfg.teams[tid]) _aaCfg.teams[tid] = { on:false, mode:'count', val:0 }; return _aaCfg.teams[tid]; }
function _aaTeamField(tid, f, v){
  var t = _aaTeamCfg(tid);
  if (f === 'on') t.on = !!v; else if (f === 'mode') t.mode = v; else t.val = Math.max(0, Number(v) || 0);
  _aaRerender();
}
// ── Chia trong Team theo %: luôn có % mặc định = chia đều, tổng 100%, hiện phần CÒN LẠI ──
function _aaTeamQuotaOf(tid){
  var tc = _aaCfg.teams[tid]; if (!tc) return 0;
  return tc.mode === 'pct' ? Math.round((_aaCfg.dailyTotal || 0) * (Number(tc.val) || 0) / 100) : Math.floor(Number(tc.val) || 0);
}
function _aaActiveMembers(tid){
  var t = teams.find(function(x){ return x.id === tid; }); if (!t) return [];
  var mc = _aaCfg.members[tid] || {};
  return _aaMembersOf(t).filter(function(m){ return !mc[m] || mc[m].on !== false; });
}
// n phần bằng nhau, tổng ĐÚNG 100 (tính theo phần trăm của 1%, dư dồn cho người đầu) — vd 3 người: 33.34 / 33.33 / 33.33
function _aaEqualPcts(n){
  if (n <= 0) return [];
  var base = Math.floor(10000 / n), rem = 10000 - base * n, out = [];
  for (var i = 0; i < n; i++) out.push((base + (i < rem ? 1 : 0)) / 100);
  return out;
}
// % đang hiển thị cho từng người đang chia: nếu chưa ai nhập (toàn 0/rỗng) → chia đều
function _aaShownPcts(tid, active){
  var mc = _aaCfg.members[tid] || {};
  var vals = active.map(function(m){ return Number((mc[m] || {}).val) || 0; });
  return vals.some(function(v){ return v > 0; }) ? vals : _aaEqualPcts(active.length);
}
function _aaMemberMode(tid, m){
  var old = _aaCfg.memberMode[tid] || 'pct';
  if (old !== m){
    var active = _aaActiveMembers(tid), mc = _aaCfg.members[tid] = _aaCfg.members[tid] || {};
    var get = function(n){ return mc[n] = mc[n] || { on:true, val:0 }; };
    if (m === 'count'){
      // % hiện tại → số KH tương ứng theo hạn mức của Team (để số "nhảy" đúng, không giữ nguyên 12 thành 12%)
      var q = _aaSplit(_aaTeamQuotaOf(tid), _aaShownPcts(tid, active));
      active.forEach(function(n, i){ get(n).val = q[i]; });
    } else {
      // số KH hiện tại → % tương ứng (tổng 100); chưa có số nào → xoá để mặc định chia đều
      var cnt = active.map(function(n){ return Math.max(0, Number((mc[n] || {}).val) || 0); });
      var sum = cnt.reduce(function(a, b){ return a + b; }, 0);
      if (sum > 0){
        var hp = _aaSplit(10000, cnt);   // phần trăm của 1% → tổng đúng 100.00
        active.forEach(function(n, i){ get(n).val = hp[i] / 100; });
      } else active.forEach(function(n){ get(n).val = 0; });
    }
  }
  _aaCfg.memberMode[tid] = m; _aaRerender();
}
function _aaMembersEqual(tid){
  var mc = _aaCfg.members[tid] = _aaCfg.members[tid] || {};
  _aaActiveMembers(tid).forEach(function(n){ (mc[n] = mc[n] || { on:true, val:0 }).val = 0; });   // 0 hết = chia đều
  _aaRerender();
}
function _aaMemberField(tid, name, f, v){
  var mc = _aaCfg.members[tid] = _aaCfg.members[tid] || {};
  var mm = _aaCfg.memberMode[tid] || 'pct';
  // Đang hiện % mặc định chia đều mà người dùng bắt đầu sửa 1 ô → GHI các % đều ra cho mọi người trước,
  // rồi mới áp phần sửa (không thì những người còn lại vẫn "rỗng" = trọng số 0 và mất phần).
  if (f === 'val' && mm === 'pct'){
    var active = _aaActiveMembers(tid);
    if (!active.some(function(n){ return Number((mc[n] || {}).val) > 0; })){
      var eq = _aaEqualPcts(active.length);
      active.forEach(function(n, i){ (mc[n] = mc[n] || { on:true, val:0 }).val = eq[i]; });
    }
  }
  var o = mc[name] = mc[name] || { on:true, val:0 };
  if (f === 'on') o.on = !!v; else o.val = Math.max(0, Number(v) || 0);
  _aaRerender();
}
function _aaRatioTeamToggle(tid){ _aaRatioTeamOpen[tid] = !_aaRatioTeamOpen[tid]; _aaRerender(); }
// Mục ② — cài tỷ lệ NGUỒN + ƯU TIÊN theo TEAM ngay tại đây (không phải mở "Chi tiết" rồi cuộn qua từng
// thành viên). Cùng dữ liệu teamSrc/teamPrio với khối "Cả Team" trong Chi tiết → _aaRatioFor đọc như cũ.
function _aaRatioTeamsHtml(){
  if (!teams.length) return '';
  var cfg = _aaCfg;
  var h = '<div style="margin-top:12px;border-top:1px dashed var(--border,#e5e3dc);padding-top:10px"><b style="font-size:12px">Cài riêng theo Team</b>'+
    '<div style="font-size:11px;color:var(--muted);margin:2px 0 6px">Bấm tên Team để cài tỷ lệ nguồn / ưu tiên cho cả Team (áp dụng cho mọi người trong Team, trừ người đã cài riêng). Chấm xanh = Team đang có tỷ lệ riêng.</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  teams.forEach(function(t){
    var has = !!((cfg.teamSrc && cfg.teamSrc[t.id]) || (cfg.teamPrio && cfg.teamPrio[t.id]) || (cfg.teamHang && cfg.teamHang[t.id]));
    h += '<span class="assign-sort-btn '+(_aaRatioTeamOpen[t.id]?'active':'')+'" onclick="_aaRatioTeamToggle(\''+esc(t.id)+'\')">'+(has?'<span style="color:var(--green)">●</span> ':'')+esc(t.name)+'</span>';
  });
  h += '</div>';
  teams.forEach(function(t){
    if (!_aaRatioTeamOpen[t.id]) return;
    h += '<div style="margin-top:8px"><b style="font-size:12px">'+esc(t.name)+'</b>'+_aaRatioHtml('src', t.id)+_aaRatioHtml('prio', t.id)+_aaRatioHtml('hang', t.id)+'</div>';
  });
  return h + '</div>';
}
function _aaOpenToggle(tid){ _aaOpen[tid] = !_aaOpen[tid]; _aaRerender(); }
function _aaRatioMode(el){ var o = _aaScopeObj(el.dataset.k, el.dataset.t, el.dataset.n, true); o.mode = el.dataset.mode; _aaRerender(); }
function _aaRatioVal(el){ var o = _aaScopeObj(el.dataset.k, el.dataset.t, el.dataset.n, true); o.vals = o.vals || {}; o.vals[el.dataset.key] = Math.max(0, Number(el.value) || 0); _aaRerender(); }
function _aaRatioAdd(el){ _aaScopeObj(el.dataset.k, el.dataset.t, el.dataset.n, true); _aaRerender(); }
function _aaRatioDel(el){
  var k = el.dataset.k, t = el.dataset.t, n = el.dataset.n;
  var key = ({ src:['teamSrc','memberSrc'], prio:['teamPrio','memberPrio'], hang:['teamHang','memberHang'] })[k][n ? 1 : 0];
  if (n) { if (_aaCfg[key] && _aaCfg[key][t]) delete _aaCfg[key][t][n]; } else if (_aaCfg[key]) delete _aaCfg[key][t];
  _aaRerender();
}
// Khối nhập tỷ lệ NGUỒN (kind='src') hoặc ƯU TIÊN (kind='prio'); tid/name rỗng = cài chung
function _aaRatioHtml(kind, tid, name){
  var keys = ({ src:_AA_POS_KEYS, prio:_AA_PRIO_KEYS, hang:_AA_HANG_KEYS })[kind], lab = ({ src:_AA_SRC_LABEL, prio:_AA_PRIO_LABEL, hang:_AA_HANG_LABEL })[kind];
  var o = _aaScopeObj(kind, tid, name, false), da = 'data-k="'+kind+'" data-t="'+esc(tid||'')+'" data-n="'+esc(name||'')+'"';
  var title = ({ src:'Tỷ lệ theo NGUỒN', prio:'Tỷ lệ theo ƯU TIÊN', hang:'Tỷ lệ theo PHÂN HẠNG KH (doanh thu)' })[kind];
  if (tid && !o) return '<button class="btn sm" '+da+' onclick="_aaRatioAdd(this)" style="margin:2px 4px 2px 0">＋ '+title+' riêng</button>';
  o = o || { mode:'pct', vals:{} };
  var sum = keys.reduce(function(s,k){ return s + (Number(o.vals[k]) || 0); }, 0), pct = o.mode !== 'count';
  var h = '<div style="margin:6px 0;padding:8px 10px;background:var(--bg2,#f6f5f2);border-radius:8px"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'+
    '<b style="font-size:12px">'+title+(tid ? ' (riêng)' : ' (chung)')+'</b>'+
    '<span class="assign-sort-btn '+(pct?'active':'')+'" '+da+' data-mode="pct" onclick="_aaRatioMode(this)">%</span>'+
    '<span class="assign-sort-btn '+(!pct?'active':'')+'" '+da+' data-mode="count" onclick="_aaRatioMode(this)">Số cụ thể</span>'+
    (tid ? '<button class="btn sm" '+da+' onclick="_aaRatioDel(this)">✕ Bỏ (dùng tỷ lệ chung)</button>' : '')+'</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">';
  keys.forEach(function(k){
    h += '<label style="font-size:12px">'+esc(lab[k])+' <input type="number" min="0" style="width:64px" value="'+(o.vals[k] != null && o.vals[k] !== 0 ? o.vals[k] : '')+'" placeholder="0" '+da+' data-key="'+k+'" onchange="_aaRatioVal(this)"> '+(pct?'%':'KH')+'</label>';
  });
  h += '</div><div style="font-size:11px;color:var(--muted);margin-top:4px">'+(sum <= 0 ? 'Chưa nhập → lấy đều mọi mục.' : (pct ? 'Tổng '+sum+'%'+(sum === 100 ? ' ✓' : sum < 100 ? ' · <b style="color:#b45309">Còn '+Math.round((100-sum)*100)/100+'% chưa phân</b> — hệ thống quy về 100%.' : ' · <b style="color:var(--red)">Vượt '+Math.round((sum-100)*100)/100+'%</b> — hệ thống quy về 100%.') : 'Tổng '+sum+' KH/người — nếu khác hạn mức của người đó, hệ thống quy theo tỷ lệ các số này.'))+
    ' Mục để trống/0 = không lấy.</div></div>';
  return h;
}
function _aaCkToggleDay(d){
  d = parseInt(d); var a = _aaCfg.cskhDays || [], i = a.indexOf(d);
  if (i >= 0) a.splice(i, 1); else a.push(d);
  _aaCfg.cskhDays = a; _aaRerender();
}
function _aaCkTeamCfg(tid){ _aaCfg.cskhTeams = _aaCfg.cskhTeams || {}; if (!_aaCfg.cskhTeams[tid]) _aaCfg.cskhTeams[tid] = { on:false, mode:'count', val:0 }; return _aaCfg.cskhTeams[tid]; }
function _aaCkTeamField(tid, f, v){
  var t = _aaCkTeamCfg(tid);
  if (f === 'on') t.on = !!v; else if (f === 'mode') t.mode = v; else t.val = Math.max(0, Number(v) || 0);
  _aaRerender();
}
function _aaCkOpenToggle(tid){ _aaCkOpen[tid] = !_aaCkOpen[tid]; _aaRerender(); }
function _aaCkMemberMode(tid, m){ _aaCfg.cskhMemberMode = _aaCfg.cskhMemberMode || {}; _aaCfg.cskhMemberMode[tid] = m; _aaRerender(); }
function _aaCkMemberField(tid, name, f, v){
  _aaCfg.cskhMembers = _aaCfg.cskhMembers || {};
  var mc = _aaCfg.cskhMembers[tid] = _aaCfg.cskhMembers[tid] || {}, o = mc[name] = mc[name] || { on:true, val:0 };
  if (f === 'on') o.on = !!v; else o.val = Math.max(0, Number(v) || 0);
  _aaRerender();
}
function _aaCkHtml(){
  var cfg = _aaCfg, ck = { teams: cfg.cskhTeams || {}, dailyTotal: cfg.cskhTotal || 0, memberMode: cfg.cskhMemberMode || {}, members: cfg.cskhMembers || {} };
  var rc = _aaRecipients(ck, teams, _aaMembersOf), qmap = {}, totalQ = rc.list.reduce(function(s, r){ return s + r.quota; }, 0);
  var ckUi = Object.assign({}, ck, { teams: {} });   // ≈ KH/ngày tính như thể Team đã bật (đổi số là thấy nhảy ngay)
  teams.forEach(function(t){ ckUi.teams[t.id] = Object.assign({ mode:'count', val:0 }, ck.teams[t.id], { on:true }); });
  _aaRecipients(ckUi, teams, _aaMembersOf).list.forEach(function(r){ qmap[r.team + '|' + r.name] = r.quota; });
  var nCk = 0; (allCustomers || []).forEach(function(c){ if (c && c.dataSrc && c.dataSrc.cskh) nCk++; });
  var h = '<div class="assign-section"><div class="assign-section-title">③ Data CSKH-Duyên — chia RIÊNG</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Mục riêng, không dính tỷ lệ nguồn/ưu tiên/hạng ở trên: mỗi người nhận số KH CSKH-Duyên bạn cài dưới đây, lấy lần lượt từ danh sách KH nguồn CSKH-Duyên (hiện có <b>'+nCk+'</b> KH). 1 SĐT không bị chia 2 lần trong cùng 1 ngày (CSKH được chia trước POS).</div>'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;margin-bottom:10px"><input type="checkbox" '+(cfg.cskhEnabled?'checked':'')+' onchange="_aaSet(\'cskhEnabled\',this.checked)"> Bật chia tự động CSKH-Duyên mỗi ngày</label>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:5px">Chia vào các thứ được tích:</div><div class="assign-sort-row">'+
    _AA_DOW.map(function(d){ return '<div class="assign-sort-btn '+((cfg.cskhDays||[]).indexOf(parseInt(d[0]))>=0?'active':'')+'" onclick="_aaCkToggleDay('+d[0]+')">'+d[1]+'</div>'; }).join('')+'</div>'+
    '<label style="font-size:12px;display:block;margin-top:10px">Tổng KH CSKH/ngày (dùng cho Team chia theo %): <input type="number" min="0" style="width:90px" value="'+(cfg.cskhTotal||'')+'" placeholder="0" onchange="_aaSet(\'cskhTotal\',this.value)"></label>';
  if (!teams.length) return h + '<div style="color:var(--muted);padding:10px;text-align:center">Chưa có Team.</div></div>';
  h += '<table class="dash-table" style="margin-top:8px"><thead><tr><th style="width:36px"></th><th>Team</th><th style="width:150px">Cách chia</th><th style="width:100px">Giá trị</th><th style="width:100px;text-align:right">≈ KH/ngày</th><th style="width:90px"></th></tr></thead><tbody>';
  teams.forEach(function(t){
    var c = (cfg.cskhTeams || {})[t.id] || { on:false, mode:'count', val:0 }, members = _aaMembersOf(t), tid = esc(t.id);
    var tq = rc.list.filter(function(r){ return r.team === t.id; }).reduce(function(s, r){ return s + r.quota; }, 0);
    h += '<tr><td><input type="checkbox" '+(c.on?'checked':'')+' onchange="_aaCkTeamField(\''+tid+'\',\'on\',this.checked)"></td>'+
      '<td><b>'+esc(t.name)+'</b> <span style="color:var(--muted);font-size:11px">('+members.length+' người)</span></td>'+
      '<td><select onchange="_aaCkTeamField(\''+tid+'\',\'mode\',this.value)"><option value="count" '+(c.mode!=='pct'?'selected':'')+'>Số KH / ngày</option><option value="pct" '+(c.mode==='pct'?'selected':'')+'>% tổng / ngày</option></select></td>'+
      '<td><input type="number" min="0" style="width:70px" value="'+(c.val||'')+'" placeholder="0" onchange="_aaCkTeamField(\''+tid+'\',\'val\',this.value)"> '+(c.mode==='pct'?'%':'KH')+'</td>'+
      '<td style="text-align:right;font-weight:700">'+(c.on?tq:'—')+'</td>'+
      '<td><button class="btn sm" onclick="_aaCkOpenToggle(\''+tid+'\')">'+(_aaCkOpen[t.id]?'▴ Thu':'▾ Chi tiết')+'</button></td></tr>';
    if (_aaCkOpen[t.id]){
      var mm = (cfg.cskhMemberMode || {})[t.id] || 'pct', pctMode = mm === 'pct', mc = (cfg.cskhMembers || {})[t.id] || {};
      var d = '<div style="padding:6px 0"><div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><b style="font-size:12px">Chia trong Team:</b>'+
        '<span class="assign-sort-btn '+(pctMode?'active':'')+'" onclick="_aaCkMemberMode(\''+tid+'\',\'pct\')">Theo % (trống = chia đều)</span>'+
        '<span class="assign-sort-btn '+(!pctMode?'active':'')+'" onclick="_aaCkMemberMode(\''+tid+'\',\'count\')">Số KH/người/ngày</span></div>';
      members.forEach(function(m){
        var o = mc[m] || { on:true, val:0 }, isOn = o.on !== false;
        d += '<div style="border-top:1px solid var(--border,#e5e3dc);padding:6px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
          '<label style="min-width:150px;font-size:13px"><input type="checkbox" '+(isOn?'checked':'')+' data-m="'+esc(m)+'" onchange="_aaCkMemberField(\''+tid+'\',this.dataset.m,\'on\',this.checked)"> '+esc(m)+'</label>'+
          '<input type="number" min="0" style="width:70px" value="'+(o.val||'')+'" placeholder="0" data-m="'+esc(m)+'" onchange="_aaCkMemberField(\''+tid+'\',this.dataset.m,\'val\',this.value)"> '+(pctMode?'%':'KH/ngày')+
          '<b style="font-size:12px;color:var(--green)">≈ '+(isOn ? (qmap[t.id+'|'+m]||0) : 0)+' KH/ngày</b></div>';
      });
      h += '<tr><td></td><td colspan="5">'+d+'</div></td></tr>';
    }
  });
  h += '</tbody></table><div style="font-size:12px;margin-top:6px;color:var(--muted)">Tổng hạn mức CSKH mỗi ngày: <b style="color:var(--green)">'+totalQ+' KH</b>'+(rc.warn.length ? ' · <span style="color:var(--red)">'+rc.warn.map(esc).join('; ')+'</span>' : '')+'</div></div>';
  return h;
}
function renderAssignAuto(){
  var body = document.getElementById('assign-body'); if (!body) return;
  var cfg = _aaCfg, rc = _aaRecipients(cfg, teams, _aaMembersOf), qmap = {};
  // Số "≈ KH/ngày" của từng người tính như thể Team đã bật → đổi % / số KH là thấy số nhảy ngay, kể cả khi Team chưa tích.
  // (Tổng hạn mức thật ở dưới — totalQ — vẫn chỉ tính Team đã tích.)
  var cfgUi = Object.assign({}, cfg, { teams: {} });
  teams.forEach(function(t){ cfgUi.teams[t.id] = Object.assign({ mode:'count', val:0 }, cfg.teams[t.id], { on:true }); });
  _aaRecipients(cfgUi, teams, _aaMembersOf).list.forEach(function(r){ qmap[r.team + '|' + r.name] = r.quota; });
  var totalQ = rc.list.reduce(function(s,r){ return s + r.quota; }, 0);
  var h = '<div class="assign-section"><div class="assign-section-title">⏰ Lịch chia tự động</div>'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;margin-bottom:10px"><input type="checkbox" '+(cfg.enabled?'checked':'')+' onchange="_aaSet(\'enabled\',this.checked)"> Bật chia tự động mỗi ngày <span style="font-weight:400;color:var(--muted)">(nguồn POS: DT tổng, Dữ liệu đơn, Chăm sóc)</span></label>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:5px">Chia vào các thứ được tích (ngày bỏ tích = không chia):</div><div class="assign-sort-row">'+
    _AA_DOW.map(function(d){ return '<div class="assign-sort-btn '+((cfg.days||[]).indexOf(parseInt(d[0]))>=0?'active':'')+'" onclick="_aaToggleDay('+d[0]+')">'+d[1]+'</div>'; }).join('')+'</div>'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-top:10px"><input type="checkbox" '+(cfg.onlyUnassigned?'checked':'')+' onchange="_aaSet(\'onlyUnassigned\',this.checked)"> Chỉ lấy KH <b>chưa chia lần nào</b> (nên bật, nếu không ngày nào cũng có thể chia lại đúng KH cũ)</label>'+
    '<label style="font-size:12px;display:block;margin-top:10px">Chia từ <input type="number" min="0" max="23" style="width:56px" value="'+(cfg.runHour==null?7:cfg.runHour)+'" onchange="_aaSet(\'runHour\',this.value)"> giờ sáng (giờ VN) — trước giờ này không chia</label>'+
    '<div style="font-size:11px;color:var(--hint);margin-top:8px">Chạy tự động bằng <b>trigger trên Google Apps Script</b> (không cần mở CRM): admin cài 1 lần — mở Apps Script Editor, chọn hàm <b>installAutoAssignTrigger_</b>, bấm Run. Chưa cài trigger thì hệ thống chỉ chia khi có admin mở CRM vào ngày đó. Sau khi sửa ở đây nhớ bấm <b>💾 Lưu cấu hình</b> (server dùng bản đã lưu).</div></div>';

  h += '<div class="assign-section"><div class="assign-section-title">① Chia cho các Team <span style="font-weight:400;font-size:12px;color:var(--muted)">— nguồn POS</span></div>'+
    '<label style="font-size:12px">Tổng KH/ngày (dùng cho Team chia theo %): <input type="number" min="0" style="width:90px" value="'+(cfg.dailyTotal||'')+'" placeholder="0" onchange="_aaSet(\'dailyTotal\',this.value)"></label>';
  if (!teams.length) h += '<div style="color:var(--muted);padding:14px;text-align:center">Chưa có Team — tạo ở tab <b>Quản lý Team</b> trước.</div>';
  else {
    var pctSum = 0;
    teams.forEach(function(t){ var c = cfg.teams[t.id]; if (c && c.on && c.mode === 'pct') pctSum += Number(c.val) || 0; });
    h += '<table class="dash-table" style="margin-top:8px"><thead><tr><th style="width:36px"></th><th>Team</th><th style="width:150px">Cách chia</th><th style="width:100px">Giá trị</th><th style="width:100px;text-align:right">≈ KH/ngày</th><th style="width:90px"></th></tr></thead><tbody>';
    teams.forEach(function(t){
      var c = cfg.teams[t.id] || { on:false, mode:'count', val:0 }, members = _aaMembersOf(t);
      var tq = rc.list.filter(function(r){ return r.team === t.id; }).reduce(function(s,r){ return s + r.quota; }, 0);
      h += '<tr><td><input type="checkbox" '+(c.on?'checked':'')+' onchange="_aaTeamField(\''+esc(t.id)+'\',\'on\',this.checked)"></td>'+
        '<td><b>'+esc(t.name)+'</b> <span style="color:var(--muted);font-size:11px">('+members.length+' người)</span></td>'+
        '<td><select onchange="_aaTeamField(\''+esc(t.id)+'\',\'mode\',this.value)"><option value="count" '+(c.mode!=='pct'?'selected':'')+'>Số KH / ngày</option><option value="pct" '+(c.mode==='pct'?'selected':'')+'>% tổng / ngày</option></select></td>'+
        '<td><input type="number" min="0" style="width:70px" value="'+(c.val||'')+'" placeholder="0" onchange="_aaTeamField(\''+esc(t.id)+'\',\'val\',this.value)"> '+(c.mode==='pct'?'%':'KH')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+(c.on?tq:'—')+'</td>'+
        '<td><button class="btn sm" onclick="_aaOpenToggle(\''+esc(t.id)+'\')">'+(_aaOpen[t.id]?'▴ Thu':'▾ Chi tiết')+'</button></td></tr>';
      if (_aaOpen[t.id]) h += '<tr><td></td><td colspan="5">'+_aaTeamDetailHtml(t, members, qmap)+'</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div style="font-size:12px;margin-top:6px;color:var(--muted)">Tổng hạn mức mỗi ngày: <b style="color:var(--green)">'+totalQ+' KH</b>'+
      (pctSum ? ' · Tổng % Team: <b style="color:'+(pctSum>100?'var(--red)':'var(--green)')+'">'+pctSum+'%</b>'+(pctSum>100?' — vượt 100%!':'') : '')+'</div>';
  }
  h += '</div>';
  h += '<div class="assign-section"><div class="assign-section-title">② Tỷ lệ chung theo nguồn &amp; ưu tiên <span style="font-weight:400;font-size:12px;color:var(--muted)">— chỉ áp dụng nguồn POS</span></div>'+
    '<div style="font-size:11px;color:var(--muted)">Áp dụng cho mọi người, trừ chỗ bạn cài riêng theo Team / từng người (bấm “Chi tiết” ở Team). Mỗi người: hạn mức → chia theo nguồn → mỗi nguồn chia tiếp theo ưu tiên.</div>'+
    _aaRatioHtml('src') + _aaRatioHtml('prio') + _aaRatioHtml('hang') + _aaRatioTeamsHtml() + '</div>';
  h += _aaCkHtml();
  var lr = cfg.lastResult;
  if (lr) h += '<div class="assign-section"><div class="assign-section-title">Lần chạy gần nhất</div><div style="font-size:12px">'+esc(lr.date)+(lr.forced?' (chạy thử)':'')+(lr.by?' · bởi '+(lr.by==='server'?'server (trigger)':'trình duyệt'):'')+': đã chia <b>'+lr.total+' KH</b> cho '+(lr.people||0)+' CS'+
    ((lr.short||[]).length ? '<div style="color:var(--red);margin-top:4px">Thiếu data: '+lr.short.map(function(s){ return esc(s.name)+' thiếu '+s.missing; }).join(', ')+'</div>' : '')+'</div></div>';
  h += '<div id="aa-preview"></div>';
  body.innerHTML = h;
}
function _aaTeamDetailHtml(t, members, qmap){
  var mm = _aaCfg.memberMode[t.id] || 'pct', mc = _aaCfg.members[t.id] || {}, tid = esc(t.id), pctMode = mm === 'pct';
  var active = _aaActiveMembers(t.id), shown = _aaShownPcts(t.id, active), pm = {};
  active.forEach(function(m, i){ pm[m] = shown[i]; });
  var h = '<div style="padding:6px 0"><div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><b style="font-size:12px">Chia trong Team:</b>'+
    '<span class="assign-sort-btn '+(pctMode?'active':'')+'" onclick="_aaMemberMode(\''+tid+'\',\'pct\')">Theo %</span>'+
    '<span class="assign-sort-btn '+(!pctMode?'active':'')+'" onclick="_aaMemberMode(\''+tid+'\',\'count\')">Số KH/người/ngày</span></div>';
  // Thanh cân đối: % → tổng phải 100, hiện phần CÒN LẠI; số KH → so với hạn mức Team
  var bar;
  if (pctMode){
    var sum = Math.round(shown.reduce(function(a, b){ return a + b; }, 0) * 100) / 100, rem = Math.round((100 - sum) * 100) / 100;
    var cls = rem === 0 ? 'ok' : rem > 0 ? 'warn' : 'err';
    bar = '<span class="assign-remaining-badge '+cls+'">'+(rem === 0 ? '✓ Đủ 100%' : rem > 0 ? 'Còn '+rem+'% chưa phân' : '⚠ Vượt '+(-rem)+'%')+'</span>'+
      '<span style="font-size:12px;color:var(--muted)">Tổng '+sum+'%</span>'+
      '<button class="btn sm" onclick="_aaMembersEqual(\''+tid+'\')">⚖ Chia đều</button>';
  } else {
    var tot = active.reduce(function(a, m){ return a + Math.max(0, Math.floor(Number((mc[m] || {}).val) || 0)); }, 0), tq = _aaTeamQuotaOf(t.id), remK = tq - tot;
    var cls2 = remK === 0 ? 'ok' : remK > 0 ? 'warn' : 'err';
    bar = '<span class="assign-remaining-badge '+cls2+'">'+(remK === 0 ? '✓ Khớp hạn mức Team' : remK > 0 ? 'Còn '+remK+' KH chưa phân' : '⚠ Vượt '+(-remK)+' KH')+'</span>'+
      '<span style="font-size:12px;color:var(--muted)">Đã chia '+tot+(tq ? ' / '+tq : '')+' KH/ngày</span>';
  }
  h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'+bar+'</div>';
  h += '<div style="padding-bottom:6px"><b style="font-size:12px">Cả Team (áp dụng cho mọi người trong Team, trừ người có tỷ lệ riêng):</b>'+_aaRatioHtml('src', t.id)+_aaRatioHtml('prio', t.id)+_aaRatioHtml('hang', t.id)+'</div>';
  members.forEach(function(m){
    var o = mc[m] || { on:true, val:0 }, isOn = o.on !== false;
    var val = pctMode ? (isOn && pm[m] != null ? pm[m] : '') : (o.val || '');
    h += '<div style="border-top:1px solid var(--border,#e5e3dc);padding:6px 0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label style="min-width:150px;font-size:13px"><input type="checkbox" '+(isOn?'checked':'')+' data-m="'+esc(m)+'" onchange="_aaMemberField(\''+tid+'\',this.dataset.m,\'on\',this.checked)"> '+esc(m)+'</label>'+
      '<input type="number" min="0" step="'+(pctMode?'0.1':'1')+'" style="width:70px" value="'+val+'" placeholder="0" data-m="'+esc(m)+'" onchange="_aaMemberField(\''+tid+'\',this.dataset.m,\'val\',this.value)"> '+(pctMode?'%':'KH/ngày')+
      '<b style="font-size:12px;color:var(--green)">≈ '+(isOn ? (qmap[t.id+'|'+m]||0) : 0)+' KH/ngày</b></div>'+
      '<div style="margin-left:4px">'+_aaRatioHtml('src', t.id, m)+_aaRatioHtml('prio', t.id, m)+_aaRatioHtml('hang', t.id, m)+'</div></div>';
  });
  return h + '</div>';
}
// Xem trước (không ghi gì) — tính trên toàn bộ KH nên bấm mới chạy
function _aaShowPreview(){
  var el = document.getElementById('aa-preview'); if (!el) return;
  var p = _aaPreview(), total = p.entries.reduce(function(s,e){ return s + e.phones.length; }, 0);
  var h = '<div class="assign-section"><div class="assign-section-title">👁 Xem trước (chưa chia thật)</div><div style="font-size:13px;margin-bottom:6px">Nếu chạy bây giờ: <b>'+total+' KH</b> → '+p.entries.length+' CS</div>';
  if (p.warn.length) h += '<div style="color:var(--red);font-size:12px">'+p.warn.map(esc).join('<br>')+'</div>';
  if (p.entries.length){
    var sh = {}; p.short.forEach(function(s){ sh[s.name + '|' + (s.src || 'pos')] = s.missing; });
    h += '<table class="dash-table"><thead><tr><th>Team</th><th>CS</th><th style="text-align:right">Hạn mức</th><th style="text-align:right">Có data</th><th>Ghi chú</th></tr></thead><tbody>'+
      p.entries.map(function(e){ return '<tr><td>'+esc(e.team)+(e.src==='cskh'?' <b style="color:#b45309">· CSKH</b>':'')+'</td><td>'+esc(e.name)+'</td><td style="text-align:right">'+e.quota+'</td><td style="text-align:right;font-weight:700">'+e.phones.length+'</td><td style="color:var(--red)">'+(sh[e.name+'|'+(e.src||'pos')]?'thiếu '+sh[e.name+'|'+(e.src||'pos')]:'')+'</td></tr>'; }).join('')+'</tbody></table>';
  } else h += '<div style="color:var(--muted);font-size:12px">Chưa có ai có hạn mức &gt; 0 hoặc không có KH phù hợp — kiểm tra lại Team đã tích, giá trị, nguồn.</div>';
  el.innerHTML = h + '</div>';
  el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
// Bảng kết quả HIỆN CỐ ĐỊNH trong tab (toast 2,4s ở góc dưới rất dễ trượt mắt): báo rõ đã chia bao nhiêu KH cho ai,
// ai thiếu data, và nếu 0 KH thì vì sao. r = kết quả _aaRunIfDue; r.error = lý do không chạy được.
function _aaShowRunResult(r){
  var el = document.getElementById('aa-preview'); if (!el) return;
  var hhmm = new Date().toTimeString().slice(0,5), h;
  if (r.error){
    h = '<div class="assign-section" style="border:1px solid #fecaca;background:#fef2f2"><div class="assign-section-title">❌ Chưa chia được ('+hhmm+')</div><div style="font-size:13px">'+esc(r.error)+'</div></div>';
  } else {
    var p = r.plan, sh = {}; p.short.forEach(function(x){ sh[x.name+'|'+(x.src||'pos')] = x.missing; });
    var ok = r.total > 0;
    h = '<div class="assign-section" style="border:1px solid '+(ok?'#bbf7d0':'#fed7aa')+';background:'+(ok?'#f0fdf4':'#fff7ed')+'">'+
      '<div class="assign-section-title">'+(ok ? '✅ Đã chia xong lúc '+hhmm : '⚠ Không chia được KH nào ('+hhmm+')')+'</div>'+
      '<div style="font-size:14px;margin-bottom:6px"><b>'+r.total+' KH</b> → '+r.entries.length+' CS'+(ok ? ' · đã ghi vào tab <b>Lịch sử chia</b> và đang đồng bộ lên server.' : '')+'</div>';
    if (p.warn.length) h += '<div style="color:var(--red);font-size:12px;margin-bottom:4px">'+p.warn.map(esc).join('<br>')+'</div>';
    if (ok){
      h += '<table class="dash-table"><thead><tr><th>Team</th><th>CS</th><th style="text-align:right">Hạn mức</th><th style="text-align:right">Đã chia</th><th>Ghi chú</th></tr></thead><tbody>'+
        p.entries.map(function(e){ return '<tr><td>'+esc(e.team)+(e.src==='cskh'?' <b style="color:#b45309">· CSKH</b>':'')+'</td><td>'+esc(e.name)+'</td><td style="text-align:right">'+e.quota+'</td><td style="text-align:right;font-weight:700">'+e.phones.length+'</td><td style="color:var(--red)">'+(sh[e.name+'|'+(e.src||'pos')]?'thiếu '+sh[e.name+'|'+(e.src||'pos')]+' KH (hết data phù hợp)':'')+'</td></tr>'; }).join('')+'</tbody></table>';
    } else {
      h += '<div style="font-size:12px;color:var(--muted)">Kiểm tra: Team đã tích chưa · hạn mức &gt; 0 chưa · nguồn/ưu tiên có KH phù hợp không · bật "Chỉ lấy KH chưa chia lần nào" thì có thể đã chia hết KH chưa từng chia.'+(p.short.length ? '<br>Thiếu data: '+p.short.map(function(x){ return esc(x.name)+' thiếu '+x.missing; }).join(', ') : '')+'</div>';
    }
    h += '</div>';
  }
  el.innerHTML = h;
  el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
async function _aaRunNow(){
  if (!confirm('Chia NGAY theo cấu hình hiện tại?\nViệc này chia thật (ghi lịch sử + đổi CS chăm sóc) và không ảnh hưởng lịch tự động ngày mai.')) return;
  var btn = document.getElementById('aa-run-btn'), old = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang chia...'; }
  var pv = document.getElementById('aa-preview'); if (pv) pv.innerHTML = '<div class="assign-section"><div style="font-size:13px">⏳ Đang chia, đợi chút...</div></div>';
  var r;
  try { await _aaPersist(); r = await _aaRunIfDue(true); }
  catch(e){ r = { error: 'Lỗi: ' + (e && e.message ? e.message : e) }; }
  finally { if (btn){ btn.disabled = false; btn.textContent = old; } }
  r = r || { error: 'Không chạy được.' };
  _aaRerender();            // vẽ lại tab (cập nhật "Lần chạy gần nhất") rồi mới ghi bảng kết quả, nếu không sẽ bị xoá
  _aaShowRunResult(r);
  toast(r.error ? '❌ ' + r.error : r.total ? '✅ Đã chia ' + r.total + ' KH → ' + r.entries.length + ' CS' : '⚠ Không có KH nào để chia');
}
async function _aaSaveNow(){ await _aaPersist(); toast('✓ Đã lưu cấu hình chia tự động'); }

function toggleNoActionChip(e){
  if (e) e.preventDefault();
  _noActionActive = !_noActionActive;
  // Sync hidden filter checkbox (dùng bởi applyFilters)
  var hid = document.getElementById('no-action-filter');
  if (hid) hid.checked = _noActionActive;
  // Sync visible checkbox bên trong label để CSS :has(input:checked) tự đổi màu chip
  var cb = document.getElementById('no-action-checkbox');
  if (cb) cb.checked = _noActionActive;
  if (typeof applyFilters === 'function') applyFilters();
}

function _updateNoActionBadge(){
  var badge = document.getElementById('no-action-badge');
  if (!badge) return;
  var list = (typeof _lastFilteredObjs !== 'undefined' && _lastFilteredObjs && _lastFilteredObjs.length)
    ? _lastFilteredObjs
    : (typeof customers !== 'undefined' ? customers : []);
  // Khi đang bật: hiện số KH trong kết quả (đã lọc ra)
  // Khi tắt: đếm KH chưa tác động trong danh sách hiện tại
  var count = _noActionActive
    ? list.length
    : list.filter(function(c){ return !c._lastActionDate; }).length;
  if (count > 0){
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// Đọc nhanh (chỉ ~20 dòng đầu mỗi sheet) để đoán loại file. Trả '' nếu không nhận ra.
function _upSniffKind_(file){
  return new Promise(function(resolve){
    var r = new FileReader();
    r.onload = function(ev){
      try {
        var wb = XLSX.read(ev.target.result, { type: 'array', sheetRows: 20 });
        var names = wb.SheetNames || [];
        var nfc = function(v){ return String(v == null ? '' : v).normalize('NFC').trim(); };
        if (names.some(function(n){ return /By user$/i.test(n); })) return resolve('pk_eng');
        if (names.some(function(n){ return /By staff$/i.test(n); })) return resolve('pk_staff');
        var isTag = names.some(function(sn){
          if (!/^\d+$/.test(sn.trim())) return false;      // file tag: sheet tên chỉ gồm số "<pageId>"
          var a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
          for (var i = 0; i < Math.min(a.length, 15); i++){ if (nfc(a[i][0]) === 'ID' && nfc(a[i][1]) === 'name') return true; }
          return false;
        });
        if (isTag) return resolve('pk_tag');
        var wsB = wb.Sheets['Tất cả'] || wb.Sheets[names[0]];
        var hB = wsB ? (XLSX.utils.sheet_to_json(wsB, { header: 1, defval: '', raw: false })[0] || []) : [];
        if (nfc(hB[0]) === 'Ngày tạo') return resolve('base');
        var wsP = wb.Sheets[names[0]];
        var hP = wsP ? (XLSX.utils.sheet_to_json(wsP, { header: 1, defval: '', raw: false })[0] || []) : [];
        if (nfc(hP[1]) === 'Ngày tạo đơn') return resolve('pos');
        resolve('');
      } catch (e) { resolve(''); }
    };
    r.onerror = function(){ resolve(''); };
    r.readAsArrayBuffer(file);
  });
}

// Đọc đầy đủ file theo loại đã chọn, dùng đúng các hàm đọc file của từng mục.
async function _upParse_(it){
  it.warn = ''; it.rows = null; it.msg = '';
  if (!it.kind){ it.status = 'unknown'; return; }
  it.status = 'parsing';
  try {
    var res;
    if (it.kind === 'base' || it.kind === 'pos'){ res = await _impParseFile(it.file, it.kind); it.warn = res.warn || ''; }
    else if (it.kind === 'pk_eng'){ res = await _pkParseFile(it.file); it.warn = (res.warnings || []).join(' | '); }
    else if (it.kind === 'pk_staff'){ res = await _pkParseSdtFile(it.file); it.warn = (res.warnings || []).join(' | '); }
    else { res = await _pkParseTagFile(it.file); it.warn = (res.warnings || []).join(' | '); }
    if (!res.rows || !res.rows.length){
      it.status = 'error'; it.msg = 'Không đọc được dòng nào theo loại "' + _UP_KINDS[it.kind].short + '" — chọn lại đúng loại ở cột "Loại".';
      return;
    }
    it.rows = res.rows; it.status = 'ready';
  } catch (e) { it.status = 'error'; it.msg = 'Lỗi đọc file: ' + e.message; }
}

async function _upAddFiles(fileList){
  var files = Array.prototype.slice.call(fileList || []);
  if (!files.length || _upState.busy) return;
  // đã lưu xong hết lượt trước → bắt đầu danh sách mới
  if (_upState.items.length && _upState.items.every(function(i){ return i.status === 'done'; })) _upState.items = [];
  var added = [];
  files.forEach(function(f){
    if (!/\.xlsx?$/i.test(f.name)){ toast('⚠️ Bỏ qua "' + f.name + '" — chỉ nhận file .xlsx / .xls'); return; }
    if (_upState.items.some(function(i){ return i.name === f.name && i.file.size === f.size; })) return; // đã có trong danh sách
    var it = { id: ++_upState.seq, file: f, name: f.name, kind: '', status: 'parsing', rows: null, warn: '', msg: '' };
    _upState.items.push(it); added.push(it);
  });
  renderUploadDataTab();
  for (var i = 0; i < added.length; i++){
    added[i].kind = await _upSniffKind_(added[i].file);
    await _upParse_(added[i]);
    renderUploadDataTab();
  }
}

async function _upSetKind(id, kind){
  var it = _upState.items.filter(function(x){ return x.id === id; })[0];
  if (!it || _upState.busy) return;
  it.kind = kind; renderUploadDataTab();
  await _upParse_(it); renderUploadDataTab();
}
function _upRemove(id){ if (_upState.busy) return; _upState.items = _upState.items.filter(function(x){ return x.id !== id; }); renderUploadDataTab(); }
function _upClear(){ if (_upState.busy) return; _upState.items = []; renderUploadDataTab(); }

// Chạy 1 hàm lưu có sẵn nhưng gom thông báo (toast) của nó lại thay vì nháy từng cái; trả về thông báo cuối.
async function _upRun_(fn){
  var orig = toast, last = '';
  toast = function(m){ last = String(m == null ? '' : m); };
  try { await fn(); } catch (e) { last = '❌ ' + e.message; } finally { toast = orig; }
  return last;
}
function _upClean_(m){ return String(m || '').replace(/^[✓✅❌⚠️\s]+/, '').trim(); }

async function _upSaveItem_(it){
  it.status = 'saving'; renderUploadDataTab();
  var k = it.kind, msg = '', ok = false;
  if (_UP_KINDS[k].admin && !_srIsAdmin()){ it.status = 'error'; it.msg = 'Chỉ Admin được nhập dữ liệu ' + _UP_KINDS[k].short + '.'; return; }
  if (k === 'base' || k === 'pos'){
    if (k === 'base'){ _impState.baseRows = it.rows; _impState.baseFileName = it.name; _impState.baseWarn = ''; }
    else { _impState.posRows = it.rows; _impState.posFileName = it.name; _impState.posWarn = ''; }
    _impState.result = null;
    msg = await _upRun_(function(){ return _impUpload(k); });
    var r = _impState.result; ok = !!(r && r.kind === k);
    if (ok) it.msg = 'Đã nhập ' + fmt(r.written) + ' dòng mới' + (r.dedupedAfter ? ' · tự loại ' + fmt(r.dedupedAfter) + ' dòng trùng' : '');
    else { if (k === 'base') _impState.baseRows = null; else _impState.posRows = null; it.msg = _upClean_(msg) || 'Lưu lỗi.'; }
  } else if (k === 'pk_eng'){
    _pkState.parsedRows = it.rows; _pkState.parsedUnmapped = [];
    msg = await _upRun_(_pkUploadToCRM);
    ok = _pkState.parsedRows.length === 0;     // hàm gốc tự xoá parsedRows khi lưu thành công
    if (!ok){ _pkState.parsedRows = []; _pkState.parsedUnmapped = []; }
    it.msg = _upClean_(msg) || (ok ? 'Đã lưu ' + fmt(it.rows.length) + ' dòng.' : 'Lưu lỗi.');
  } else if (k === 'pk_staff'){
    _pkState.sdtParsedRows = it.rows;
    msg = await _upRun_(_pkUploadSdtToCRM);
    ok = _pkState.sdtParsedRows.length === 0;
    if (!ok) _pkState.sdtParsedRows = [];
    it.msg = _upClean_(msg) || (ok ? 'Đã lưu ' + fmt(it.rows.length) + ' dòng.' : 'Lưu lỗi.');
  }
  it.status = ok ? 'done' : 'error';
}

// File tag: gộp TẤT CẢ file tag vào kho tag rồi lưu 1 lần (hàm gốc gửi cả kho lên server).
async function _upSaveTags_(list){
  list.forEach(function(it){ it.status = 'saving'; }); renderUploadDataTab();
  _pkTagLoad();
  list.forEach(function(it){ _pkTagMerge(it.rows); });
  _pkTagSave(); _pkTagResetRange();
  var before = _pkState.tagSavedAt; _pkState.tagSavedAt = '';
  var msg = await _upRun_(_pkTagSaveToServer);
  var ok = !!_pkState.tagSavedAt;
  if (!ok) _pkState.tagSavedAt = before;
  list.forEach(function(it){ it.status = ok ? 'done' : 'error'; it.msg = _upClean_(msg) || (ok ? 'Đã lưu.' : 'Lưu lỗi.'); });
}

async function _upSaveAll(){
  if (_upState.busy) return;
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  var ready = _upState.items.filter(function(i){ return i.status === 'ready'; });
  if (!ready.length){ toast('Chưa có file nào sẵn sàng để lưu.'); return; }
  _upState.busy = true; renderUploadDataTab();
  // _impUpload vẽ lại tab Báo cáo doanh số → giữ ở sub-tab nhập (nhẹ) để khỏi kích hoạt tải báo cáo nặng; trả lại sau khi xong
  var prevSub = (typeof _srState !== 'undefined') ? _srState.sub : null;
  if (typeof _srState !== 'undefined') _srState.sub = 'J';
  try {
    for (var oi = 0; oi < _UP_ORDER.length; oi++){
      var kind = _UP_ORDER[oi];
      var list = ready.filter(function(i){ return i.kind === kind; });
      if (!list.length) continue;
      if (kind === 'pk_tag'){ await _upSaveTags_(list); renderUploadDataTab(); continue; }
      for (var li = 0; li < list.length; li++){ await _upSaveItem_(list[li]); renderUploadDataTab(); }
    }
  } finally {
    if (typeof _srState !== 'undefined' && prevSub != null) _srState.sub = prevSub;
    _upState.busy = false; renderUploadDataTab();
  }
  var done = ready.filter(function(i){ return i.status === 'done'; }).length;
  toast(done === ready.length ? '✅ Đã lưu ' + done + '/' + ready.length + ' file lên CRM.' : '⚠️ Lưu được ' + done + '/' + ready.length + ' file — xem dòng lỗi trong bảng.');
}

function _upDateRange_(rows){
  var ds = {}; rows.forEach(function(r){ if (r && r.date) ds[r.date] = 1; });
  var a = Object.keys(ds).sort(); if (!a.length) return '';
  return a.length === 1 ? a[0] : a[0] + ' → ' + a[a.length - 1] + ' (' + a.length + ' ngày)';
}

function renderUploadDataTab(){
  var wrap = document.getElementById('uploaddata-wrap'); if (!wrap) return;
  // cần bảng khớp tên NV Pancake để cảnh báo tên chưa khớp (không chặn việc lưu)
  if (!_pkState.nameMapLoaded && !_upState.nmLoading && typeof _pkLoadNameMap === 'function'){
    _upState.nmLoading = true;
    Promise.resolve(_pkLoadNameMap()).catch(function(){}).then(function(){ _upState.nmLoading = false; renderUploadDataTab(); });
  }
  var items = _upState.items, busy = _upState.busy;
  var readyN = items.filter(function(i){ return i.status === 'ready'; }).length;
  var html = '<div class="dash-section-title" style="margin-top:0">📤 Up dữ liệu hằng ngày</div>';
  html += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Chọn hoặc <b>kéo thả cùng lúc</b> tất cả file hôm nay (Base, Pos, 3 file Pancake). Hệ thống tự nhận dạng từng file theo nội dung — không cần đặt tên theo quy ước. Kiểm tra bảng bên dưới rồi bấm <b>Lưu tất cả</b>.</div>';
  html += '<label ondragover="event.preventDefault();this.style.background=\'var(--surface2)\'" ondragleave="this.style.background=\'\'" ondrop="event.preventDefault();this.style.background=\'\';_upAddFiles(event.dataTransfer.files)" '
    + 'style="display:block;border:2px dashed var(--border-md);border-radius:var(--rmd);padding:22px;text-align:center;cursor:pointer;margin-bottom:12px">'
    + '<div style="font-size:15px;font-weight:600">📂 Bấm để chọn file (chọn được nhiều file) hoặc kéo thả vào đây</div>'
    + '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">.xlsx / .xls — Base · Pos · Pancake: Thống kê tương tác · Thống kê nhân viên · Thống kê tag</div>'
    + '<input type="file" accept=".xlsx,.xls" multiple style="display:none" onchange="_upAddFiles(this.files);this.value=\'\'"></label>';
  // checklist 5 loại: hôm nay đã có file nào, còn thiếu gì
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
  _UP_ORDER.forEach(function(k){
    var n = items.filter(function(i){ return i.kind === k && i.status !== 'error'; }).length;
    var done = items.some(function(i){ return i.kind === k && i.status === 'done'; });
    html += '<span style="font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:' + (done ? '#f0fdf4' : n ? 'var(--surface2)' : 'transparent') + ';color:' + (done ? '#166534' : n ? 'var(--text)' : 'var(--muted)') + '">'
      + (done ? '✓ ' : n ? '● ' : '○ ') + esc(_UP_KINDS[k].short) + (n > 1 ? ' ×' + n : '') + '</span>';
  });
  html += '</div>';
  if (items.length){
    html += '<table class="dash-table"><thead><tr><th>File</th><th style="min-width:230px">Loại</th><th>Nội dung đọc được</th><th>Trạng thái</th><th></th></tr></thead><tbody>';
    items.forEach(function(it){
      var opts = '<option value=""' + (it.kind ? '' : ' selected') + '>— chọn loại file —</option>' + _UP_ORDER.map(function(k){
        return '<option value="' + k + '"' + (it.kind === k ? ' selected' : '') + '>' + esc(_UP_KINDS[k].label) + '</option>';
      }).join('');
      var info = '';
      if (it.rows){
        info = '<b>' + fmt(it.rows.length) + '</b> dòng';
        var dr = (it.kind === 'base' || it.kind === 'pos') ? '' : _upDateRange_(it.rows);
        if (dr) info += ' · ' + esc(dr);
        if ((it.kind === 'pk_eng' || it.kind === 'pk_staff') && _pkState.nameMapLoaded){
          var um = {}; it.rows.forEach(function(r){ if (r.nhanVien && !_pkState.nameMap[r.nhanVien]) um[r.nhanVien] = 1; });
          var umN = Object.keys(um).length;
          if (umN) info += '<div style="font-size:11px;color:#9a3412;margin-top:2px" title="' + esc(Object.keys(um).join(', ')) + '">⚠ ' + umN + ' tên NV Pancake chưa khớp Sale CRM (vẫn lưu được; khớp sau ở Báo cáo Pancake → 🔗 Khớp tên)</div>';
        }
      }
      if (it.warn) info += '<div style="font-size:11px;color:#9a3412;margin-top:2px">' + esc(it.warn) + '</div>';
      var st = { parsing: '⏳ Đang đọc…', ready: '✅ Sẵn sàng', saving: '⏳ Đang lưu…', done: '✓ Đã lưu', error: '❌ Lỗi', unknown: '❓ Chưa nhận ra loại file' }[it.status] || it.status;
      var stColor = it.status === 'done' ? '#166534' : it.status === 'error' ? 'var(--red)' : it.status === 'unknown' ? '#9a3412' : 'var(--text)';
      html += '<tr><td style="word-break:break-all">📄 ' + esc(it.name) + '</td>'
        + '<td><select data-id="' + it.id + '" ' + (busy || it.status === 'saving' || it.status === 'done' ? 'disabled' : '') + ' onchange="_upSetKind(+this.dataset.id,this.value)" style="max-width:100%">' + opts + '</select></td>'
        + '<td>' + info + '</td>'
        + '<td style="color:' + stColor + ';font-weight:600">' + st + (it.msg ? '<div style="font-weight:400;font-size:11.5px;margin-top:2px">' + esc(it.msg) + '</div>' : '') + '</td>'
        + '<td><button class="btn sm secondary" ' + (busy ? 'disabled' : '') + ' onclick="_upRemove(' + it.id + ')" title="Bỏ file này">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    html += '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<button class="btn primary" ' + (busy || !readyN ? 'disabled' : '') + ' onclick="_upSaveAll()">' + (busy ? '⏳ Đang lưu…' : '💾 Lưu tất cả (' + readyN + ' file)') + '</button>'
      + '<button class="btn sm secondary" ' + (busy ? 'disabled' : '') + ' onclick="_upClear()">Xoá danh sách</button>'
      + '<span style="font-size:11.5px;color:var(--muted)">Lưu lần lượt từng file; file lỗi không làm hỏng các file còn lại.</span></div>';
  }
  html += '<details style="margin-top:20px;font-size:12px;color:var(--muted)"><summary style="cursor:pointer">Lấy file ở đâu?</summary>'
    + '<ul style="margin:8px 0 0 18px;line-height:1.7">'
    + '<li><b>Pancake — Thống kê tương tác:</b> Thống kê → Thống kê tương tác → Xuất Excel</li>'
    + '<li><b>Pancake — Thống kê nhân viên:</b> Thống kê → Thống kê nhân viên → Xuất Excel</li>'
    + '<li><b>Pancake — Thống kê tag:</b> Thống kê → Thống kê tag → Xuất Excel (nạp nhiều file được, tự gộp)</li>'
    + '<li><b>Base:</b> file export "Danh sách công việc" (sheet "Tất cả")</li>'
    + '<li><b>Pos:</b> file export đơn hàng Pancake POS</li></ul></details>';
  wrap.innerHTML = html;
}

function _rptModeBuildBar_(current){
  var dv = document.getElementById('data-view');
  if (!dv) return;
  var bar = document.getElementById('rpt-bar');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'rpt-bar';
    dv.insertBefore(bar, dv.firstChild);
  }
  var opts = _RPT_MODE_TABS.concat(['dailybrief']).filter(function(id){
    if (typeof tabVisible !== 'undefined' && tabVisible[id] === false) return false;
    if (typeof _tabAllowedForUser === 'function' && !_tabAllowedForUser(id)) return false;
    return true;
  });
  bar.innerHTML = '<select id="rpt-mode-sel" onchange="_rptModeGo_(this.value)" title="Chọn báo cáo">'
    + opts.map(function(id){ return '<option value="'+id+'"'+(id===current?' selected':'')+'>'+_RPT_MODE_LABELS[id]+'</option>'; }).join('')
    + '</select>'
    + '<button class="btn sm" onclick="_rptModeBack_()" title="Hiện lại đầy đủ menu, bộ lọc">← Về màn hình chính</button>';
}
function _rptModeGo_(id){
  var el = document.getElementById('v9tab-' + id);
  switchTab(id, el || document.createElement('div'));
}
function _rptModeBack_(){
  var el = document.querySelector("[data-bar-id='tab-kh']") || document.querySelector('.tab');
  switchTab('list', el);
}
async function _fetchGasSource(force){
  if (_gasSrcCache && !force) return _gasSrcCache;
  if (!gsUrl) return null;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var _ak = _adminKeyGet(); if (!_ak) return null;
    var r = await fetch(gsUrl + sep + 'action=getGasSource&adminKey=' + encodeURIComponent(_ak), { redirect:'follow' });
    var d = await r.json();
    if (d && d.error) { try { localStorage.removeItem('ome_admin_key'); } catch(e2){} return null; }
    if (d && d.code) { _gasSrcCache = { code: d.code, updatedAt: d.updatedAt || null }; return _gasSrcCache; }
  } catch(e) { /* mat mang -> tra null, noi goi se bao loi phu hop */ }
  return null;
}
async function syncGasSourceFromTextarea(){
  var ta = document.getElementById('gs-source-sync-input');
  if (!ta) return;
  var code = ta.value;
  if (!code || code.trim().length < 500) { toast('⚠ Nội dung có vẻ chưa đủ — dán TOÀN BỘ file gas_v13.js vào ô này.'); return; }
  if (!gsUrl) { toast('⚠ Chưa kết nối Google Sheets.'); return; }
  toast('Đang đồng bộ mã GAS...');
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setGasSource', code: code, adminKey: _adminKeyGet() }) });
    var d = await r.json();
    if (d && d.ok) {
      toast('✓ Đã đồng bộ mã GAS (' + d.chunks + ' mảnh, ' + d.length + ' ký tự)');
      _gasSrcCache = null;
      ta.value = '';
      var prev = document.getElementById('gs-code-preview');
      if (prev) prev.dataset.v9 = '';
    } else {
      toast('⚠ Đồng bộ lỗi: ' + (d && d.error ? d.error : 'không rõ nguyên nhân'));
    }
  } catch(e) { toast('⚠ Lỗi mạng khi đồng bộ: ' + e.message); }
}

// ═══════════════════════════════════════════════════════
//  INJECT UI (tabs + panels + role pill) — chạy khi load
// ═══════════════════════════════════════════════════════
// Mở/đóng dropdown "📊 Báo cáo ▾" gom 4 tab báo cáo — cùng kiểu click-để-mở/click-ra-ngoài-để-đóng
// như nút "☰ Menu" đã có (_toggleBarMenuDropdown ở trên), viết riêng vì khác điểm neo/nội dung.
function _toggleReportsGroupDropdown(e){
  if (e) e.stopPropagation();
  var list = document.getElementById('reportsgroup-list');
  if (!list) return;
  list.style.display = (list.style.display === 'none') ? 'block' : 'none';
}

function _injectV9UI(){
  if (document.getElementById('v9tab-customize')) return; // tránh chèn 2 lần (nút ⚙ luôn được thêm dù tab nào bị ẩn)
  var tabsBar = document.querySelector('.tabs');
  if (tabsBar){
    var defs = [
      { id:'dashboard',   label:'📊 Dashboard' },
      { id:'team',        label:'👥 Quản lý Team' },
      { id:'audit',       label:'🧾 Nhật ký' },
      { id:'uploaddata',  label:'📤 Up dữ liệu' }
    ];
    defs.filter(function(d){ return tabVisible[d.id] !== false; }).forEach(function(d){
      var div = document.createElement('div');
      div.className = 'tab';
      div.id = 'v9tab-' + d.id;
      div.setAttribute('data-bar-id', d.id);
      div.setAttribute('data-bar-home', '.tabs');
      div.setAttribute('onclick', "switchTab('"+d.id+"',this)");
      div.innerHTML = d.label;
      tabsBar.appendChild(div);
    });
    // Gom 4 tab báo cáo (Báo cáo doanh số / Báo cáo Pancake / KPI Pancake / Checklist MKT)
    // vào chung 1 menu sổ xuống "📊 Báo cáo ▾" cho đỡ chật thanh tab, thay vì để 4 tab rời
    // như trước (đã bỏ luôn bước đảo chỗ KPI Pancake ↔ "Quá hạn" vì không còn cần thiết —
    // KPI Pancake giờ nằm gọn trong dropdown này). Tab nào bị ẩn qua "⚙ Tuỳ chỉnh tab hiển thị"
    // (tabVisible) thì tự động không xuất hiện trong dropdown; nếu ẩn hết cả 4 thì cả nút
    // "📊 Báo cáo ▾" cũng tự ẩn theo.
    var reportDefs = [
      { id:'salesreport', label:'📈 Báo cáo doanh số' },
      { id:'pancake',     label:'📥 Báo cáo Pancake' },
      { id:'kpipancake',  label:'📈 KPI Pancake' },
      { id:'mktchecklist',label:'✅ Checklist MKT' },
      { id:'dailybrief',  label:'🎯 Báo cáo ngày' }
    ];
    var visibleReportDefs = reportDefs.filter(function(d){ return tabVisible[d.id] !== false; });
    if (visibleReportDefs.length){
      var group = document.createElement('div');
      group.className = 'tab';
      group.id = 'v9tab-reportsgroup';
      group.setAttribute('data-bar-id', 'reportsgroup');
      group.setAttribute('data-bar-home', '.tabs');
      group.setAttribute('data-bar-after', "[data-bar-id='tab-schedule']"); // luon nam NGAY CANH "Lich cham soc", du keo ra/vao ☰ Menu bao nhieu lan
      group.style.cssText = 'position:relative';
      group.innerHTML = '📊 Báo cáo ▾';
      group.setAttribute('onclick', '_toggleReportsGroupDropdown(event)');
      var rgList = document.createElement('div');
      rgList.id = 'reportsgroup-list';
      rgList.style.cssText = 'display:none;position:absolute;top:100%;left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--rmd);box-shadow:0 8px 24px rgba(0,0,0,.15);min-width:200px;z-index:950;padding:6px;';
      visibleReportDefs.forEach(function(d){
        var item = document.createElement('div');
        item.className = 'tab';
        item.id = 'v9tab-' + d.id;
        item.setAttribute('data-bar-id', d.id);
        item.setAttribute('data-bar-home', '#reportsgroup-list');
        item.style.cssText = 'display:block;padding:8px 10px;border-radius:6px;margin:0;white-space:nowrap;';
        item.setAttribute('onclick', "event.stopPropagation();switchTab('"+d.id+"',this);document.getElementById('reportsgroup-list').style.display='none';");
        item.innerHTML = d.label;
        rgList.appendChild(item);
      });
      group.appendChild(rgList);
      _barPlaceHome(group); // gan NGAY SAU "Lich cham soc" thay vi cuoi thanh tab
      document.addEventListener('click', function(e){
        var list = document.getElementById('reportsgroup-list');
        var grp = document.getElementById('v9tab-reportsgroup');
        if (!list || !grp || list.style.display === 'none') return;
        if (grp.contains(e.target)) return;
        list.style.display = 'none';
      });
    }
    var gear = document.createElement('div');
    gear.className = 'tab';
    gear.id = 'v9tab-customize';
    gear.title = 'Tuỳ chỉnh thanh menu — kéo mục vào/ra ☰ Menu theo ý bạn';
    gear.style.cssText = 'flex-shrink:0;opacity:.6';
    gear.innerHTML = '⚙';
    gear.setAttribute('onclick', 'openBarCustomizeModal()');
    tabsBar.appendChild(gear);
  }
  var dataView = document.getElementById('data-view');
  if (dataView){
    var panels = [
      { id:'tab-dashboard',   inner:'<div class="dash-wrap" id="dash-wrap"></div>' },
      { id:'tab-team',        inner:'<div class="team-wrap" id="team-wrap"></div>' },
      { id:'tab-audit',       inner:'<div class="audit-wrap" id="audit-wrap"></div>' },
      { id:'tab-uploaddata',  inner:'<div class="dash-wrap" id="uploaddata-wrap"></div>' },
      { id:'tab-salesreport', inner:'<div class="dash-wrap" id="salesreport-wrap"></div>' },
      { id:'tab-pancake',     inner:'<div class="dash-wrap" id="pancake-wrap"></div>' },
      { id:'tab-kpipancake',  inner:'<div class="dash-wrap" id="kpipancake-wrap"></div>' },
      { id:'tab-mktchecklist',inner:'<div class="dash-wrap" id="mktchecklist-wrap"></div>' },
      { id:'tab-dailybrief',  inner:'<div class="dash-wrap" id="dailybrief-wrap"></div>' }
    ];
    panels.forEach(function(p){
      if (document.getElementById(p.id)) return;
      var panel = document.createElement('div');
      panel.id = p.id;
      panel.className = 'main';
      panel.style.cssText = 'display:none;flex:1;overflow:auto;flex-direction:column';
      panel.innerHTML = p.inner;
      dataView.appendChild(panel);
    });
  }
  // role pill vào header
  var hdrR = document.querySelector('.hdr-r');
  if (hdrR && !document.getElementById('role-pill')){
    var pill = document.createElement('div');
    pill.id = 'role-pill';
    pill.className = 'role-pill admin';
    pill.style.cssText = 'cursor:pointer';
    pill.setAttribute('onclick', 'openRoleModal()');
    hdrR.insertBefore(pill, hdrR.firstChild);
  }
  // thêm tab "Theo Team" vào modal chia data
  var assignTabs = document.querySelector('.assign-tabs');
  if (assignTabs && !document.getElementById('assign-tab-team')){
    var at = document.createElement('div');
    at.className = 'assign-tab';
    at.id = 'assign-tab-team';
    at.setAttribute('onclick', "switchAssignTab('team',this)");
    at.innerHTML = '🏢 Theo Team';
    assignTabs.appendChild(at);
  }
  renderRolePill();
  _rebuildAssignIndex();
  // nếu user đã set vai trò CS từ trước → khoá bộ lọc CS
  if (currentUser.role === 'cs'){
    var csFilter = document.getElementById('cs-staff-filter');
    if (csFilter){
      var myNamesBoot = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name?[currentUser.name]:[]);
      myNamesBoot.forEach(function(n){
        var has = Array.prototype.some.call(csFilter.options, function(o){ return o.value === n; });
        if (!has){ var op=document.createElement('option'); op.value=n; op.textContent=n; csFilter.appendChild(op); }
      });
      if (myNamesBoot.length){
        if (typeof _csSetFilterSelection === 'function') _csSetFilterSelection(myNamesBoot);
        csFilter.disabled = true;
      }
      if (typeof syncCSCombo==='function') syncCSCombo();
      if (typeof updateStats==='function' && typeof allCustomers!=='undefined' && allCustomers.length){ updateStats(); updateSidebarBadges(); updateBrandList(); }
    }
    if (typeof applyFilters === 'function') applyFilters();
  }
}

function _aval(id){ var el = document.getElementById(id); return el ? (el.value || '') : ''; }

async function _hashPass(pw, salt){
  salt = salt || _PW_SALT;
  pw = String(pw == null ? '' : pw);
  try{
    if (typeof crypto !== 'undefined' && crypto.subtle){
      var data = new TextEncoder().encode(salt + pw);
      var buf = await crypto.subtle.digest('SHA-256', data);
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
    }
  }catch(e){}
  // Fallback (môi trường không có crypto.subtle) — yếu hơn nhưng vẫn dùng được
  var h = 0, s = salt + pw;
  for (var i=0;i<s.length;i++){ h = (Math.imul(h,31) + s.charCodeAt(i))|0; }
  return 'f' + (h>>>0).toString(16);
}

async function pullUsers(){
  if (!gsUrl) return false;
  try{
    var sep = gsUrl.includes('?') ? '&' : '?';
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function(){ controller.abort(); }, 15000) : null;
    var r = await fetch(gsUrl + sep + 'action=users', { redirect:'follow', signal: controller ? controller.signal : undefined });
    if (timer) clearTimeout(timer);
    var d = await r.json();
    if (d && Array.isArray(d.users)){ accounts = d.users; saveLS('ome_accounts', accounts); return true; }
  }catch(e){ console.warn('pullUsers failed:', e); }
  return false;
}
function pushUsers(){
  saveLS('ome_accounts', accounts);
  if (!gsUrl) return Promise.resolve({ ok:true, local:true });
  return fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveUsers', users: accounts }) })
    .then(function(r){ return r.json(); }).catch(function(){ return { error:'network' }; });
}
function _findAccount(username){
  username = String(username||'').trim().toLowerCase();
  for (var i=0;i<accounts.length;i++){ if (String(accounts[i].username||'').trim().toLowerCase() === username) return accounts[i]; }
  return null;
}

// Đặt currentUser theo tài khoản đăng nhập + áp dụng phạm vi xem
function _applyAuthIdentity(acct){
  _bootstrapAdmin = false;
  var namesArr = (acct.names && acct.names.length) ? acct.names.slice() : (acct.name ? [acct.name] : []);
  var primaryName = acct.role==='admin' ? 'Admin' : (namesArr[0] || acct.username);
  currentUser = { name: primaryName, names: acct.role==='admin' ? [] : namesArr, role: acct.role || 'cs', team: acct.team || '', perms: (Array.isArray(acct.perms) ? acct.perms : null) };
  if (acct.role === 'demo') {
    // Tai khoan test: chi thay cac tab bao cao (khong the nang quyen qua perms). Du lieu chi tiet da bi may chu cat con 5 dong.
    currentUser.perms = ['salesreport','pancake','kpipancake','mktchecklist','dailybrief'];
    document.body.classList.add('demo-mode');
    // Xoa cache CSKH-Duyen/don cua phien truoc tren cung trinh duyet + bo du lieu dang giu trong bo nho: test chi duoc thay 5 dong tu may chu.
    try { cskhData = {}; cskhMeta = { found: null, total: 0, noPhone: 0 }; ['ome_cskh_duyen', 'ome_cskh_duyen_meta'].forEach(function(k){ localStorage.removeItem(k); }); } catch(eC){}
    try { if (typeof _idbDel_ === 'function') { _idbDel_('cskh_lite_v1').catch(function(){}); _idbDel_('orders_v1').catch(function(){}); } } catch(eI){}
    // Vao thang bao cao doanh so (tab Danh sach KH dang bi an voi tai khoan nay)
    setTimeout(function(){ try { switchTab('salesreport', document.querySelector('[data-bar-id="reportsgroup"]')); } catch(eS){} }, 400);
  } else { document.body.classList.remove('demo-mode'); try { localStorage.removeItem('ome_demo_token'); } catch(eT){} }
  saveLS('ome_user', currentUser);
  if (typeof _applyUserTabPermissions === 'function') _applyUserTabPermissions();
  var csFilter = document.getElementById('cs-staff-filter');
  if (csFilter){
    if (currentUser.role === 'cs' && currentUser.names.length){
      // Thêm option cho từng tên (nếu chưa có trong <select>), rồi khoá bộ lọc chọn SẴN tất cả
      // tên của tài khoản này — tận dụng đúng hạ tầng multi-select "Lọc theo CS" đã có.
      currentUser.names.forEach(function(n){
        var has = Array.prototype.some.call(csFilter.options, function(o){ return o.value === n; });
        if (!has){ var op=document.createElement('option'); op.value=n; op.textContent=n; csFilter.appendChild(op); }
      });
      if (typeof _csSetFilterSelection === 'function') _csSetFilterSelection(currentUser.names);
      csFilter.disabled = true;
    } else {
      csFilter.disabled = false;
    }
    if (typeof syncCSCombo === 'function') syncCSCombo();
  }
  if (typeof renderRolePill === 'function') renderRolePill();
  if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
  if (typeof applyFilters === 'function') applyFilters();
  if (typeof updateStats === 'function' && typeof allCustomers !== 'undefined' && allCustomers.length){ updateStats(); updateSidebarBadges(); updateBrandList(); }
  _renderAuthHeader();
  // Tự động kéo chiến dịch từ GSheets về (không cần bấm Sync thủ công)
  // để danh sách KH theo chiến dịch không bị mất khi đăng nhập trên máy/tab mới
  if (gsUrl && typeof pullAssignHistory === 'function') {
    pullAssignHistory().catch(function(){});
  }
  if (gsUrl && typeof pullBroadcastHistory === 'function') {
    pullBroadcastHistory().catch(function(){});
  }
  if (typeof _pullColVisibleForAccount === 'function') {
    _pullColVisibleForAccount().catch(function(){});
  }
  if (typeof _pullTabVisibleForAccount === 'function') {
    _pullTabVisibleForAccount().catch(function(){});
  }
}

async function doLogin(){
  var errEl = document.getElementById('login-err');
  function showErr(m){ if (errEl){ errEl.textContent = m; errEl.style.display=''; } }
  var u = (_aval('login-user')||'').trim(), p = _aval('login-pass');
  if (!u || !p){ showErr('Nhập đủ tài khoản và mật khẩu.'); return; }
  var acct = _findAccount(u);
  if (!acct){ showErr('Sai tài khoản hoặc mật khẩu.'); return; }
  if (acct.active === false){ showErr('Tài khoản đã bị khoá. Liên hệ quản trị viên.'); return; }
  var h = await _hashPass(p);
  var _storedHash = acct.passHash;
  try { localStorage.removeItem('ome_demo_token'); } catch(e){}
  if (h !== acct.passHash) {
    // Tai khoan tao truoc khi doi salt OME -> CRM: thu voi salt cu, dung thi nang cap ngay
    var hOld = await _hashPass(p, _PW_SALT_OLD);
    if (hOld === acct.passHash) {
      acct.passHash = h;
      pushUsers().catch(function(){});
    } else {
      showErr('Sai tài khoản hoặc mật khẩu.'); return;
    }
  }
  if (acct.role === 'demo') {
    // Tai khoan test: xin demoToken tu may chu (chi nhan duoc voi tai khoan role demo dang hoat dong).
    try {
      var _dr = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'demoLogin', username: acct.username, passHash: _storedHash }) });
      var _dd = await _dr.json();
      if (!_dd || !_dd.ok || !_dd.token){ showErr('Không đăng nhập được tài khoản test: ' + ((_dd && _dd.error) || 'lỗi máy chủ') + '. Báo admin deploy lại GAS bản mới.'); return; }
      localStorage.setItem('ome_demo_token', _dd.token);
    } catch(eD){ showErr('Không kết nối được máy chủ để đăng nhập tài khoản test.'); return; }
  }
  _authAccount = { username: acct.username, role: acct.role, name: acct.name, team: acct.team };
  saveLS('ome_auth', _authAccount);
  // Nho ten tai khoan vua dang nhap de lan sau (ke ca sau khi dang xuat / dong trinh duyet)
  // tu dien san vao o "Tai khoan" — CHI luu username, KHONG BAO GIO luu mat khau.
  try { localStorage.setItem('ome_last_user', acct.username); } catch(e){}
  if (errEl) errEl.style.display = 'none';
  var pEl = document.getElementById('login-pass'); if (pEl) pEl.value = '';
  _hideLogin();
  _applyAuthIdentity(acct);
  if (typeof toast === 'function') toast('✓ Xin chào ' + (acct.name || acct.username) + ' (' + _roleLabel(acct.role) + ')');
}
function doLogout(){
  if (!confirm('Đăng xuất khỏi tài khoản hiện tại?')) return;
  _authAccount = null;
  try{ localStorage.removeItem('ome_auth'); localStorage.removeItem('ome_demo_token'); }catch(e){}
  document.body.classList.remove('demo-mode');
  _showLogin();
}
function _showLogin(){
  var ov = document.getElementById('login-overlay'); if (!ov) return;
  var ld = document.getElementById('login-loading'); if (ld) ld.style.display = 'none';
  var f = document.getElementById('login-form'); if (f) f.style.display = '';
  var e = document.getElementById('login-err'); if (e) e.style.display = 'none';
  ov.classList.add('show');
  // Tu dien lai ten tai khoan da dang nhap lan truoc (neu o dang trong) -> CS khong phai
  // go lai ten moi lan mo trinh duyet. Mat khau luon de trong, phai nhap lai.
  var uEl = document.getElementById('login-user');
  var lastU = '';
  try { lastU = localStorage.getItem('ome_last_user') || ''; } catch(e2){}
  if (uEl && lastU && !uEl.value) uEl.value = lastU;
  setTimeout(function(){
    var u = document.getElementById('login-user');
    var p = document.getElementById('login-pass');
    // Da co san ten -> nhay thang vao o mat khau cho tien
    if (u && u.value && p) { p.focus(); return; }
    if (u) u.focus();
  }, 60);
}

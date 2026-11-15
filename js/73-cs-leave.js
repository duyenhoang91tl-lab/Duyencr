// ════════════════════════════════════════════════════════════════════
//  R6c-2 (BƯỚC 1/4: LOGIC THUẦN) — NGHỈ PHÉP + GIAO LẠI KHÁCH. Nạp SAU js/72. Chưa có giao diện (bước 2), chưa lưu/đồng bộ (bước 3).
//  NGUYÊN NHÂN GỐC: CS nghỉ thì lịch của họ cứ quá hạn dần; quản lý phải mở từng khách đổi CS. Luật do Duyên chốt 2026-11-15:
//   (1) Admin HOẶC chính nhân viên đặt kỳ nghỉ: "từ ngày …" (chưa biết ngày về → để trống "đến ngày") hoặc "từ ngày … đến ngày …".
//   (2) Khi có người nghỉ, chọn 1 trong 2 cách giao: "chia đều" cho CS cùng team (không gồm người đang nghỉ) hoặc "chuyển cho người khác" (1 người).
//  Mô hình 1 kỳ nghỉ: { id, name, from:'YYYY-MM-DD', to:'YYYY-MM-DD'|'' (''=chưa biết ngày về), mode:'even'|'to', target:'Tên'|'', by, at, handed:[{phone,from,to,prevCs}], ended:false }
//  "Khách cần giao" = khách có lịch CHƯA xong (không tính lịch tự động autoDao / sinh nhật) mà CS chịu trách nhiệm có tên người nghỉ.
//  Giao lại = đổi đúng TÊN người nghỉ trong careData[phone].cs (CS ghi gộp "A, B" chỉ thay phần A) — lưu prevCs để "Trả lại" ở bước 4.
//  Hàm thuần: clIsOnLeave_, clPeers_, clReplaceName_, clAssign_, clPlan_ (test: node tools/test-cs-leave.js)
// ════════════════════════════════════════════════════════════════════
function clSplit_(s){ return String(s == null ? '' : s).split(',').map(function(n){ return n.trim(); }).filter(Boolean); }
function clKey_(s){ return String(s == null ? '' : s).trim().toLowerCase(); }

// Người này có đang trong kỳ nghỉ vào ngày ymd không? (to rỗng = nghỉ chưa biết ngày về; ended = đã trả lại/đã đi làm)
function clIsOnLeave_(leaves, name, ymd){
  var k = clKey_(name); if (!k) return false;
  return (leaves || []).some(function(l){
    return !l.ended && clKey_(l.name) === k && l.from && l.from <= ymd && (!l.to || ymd <= l.to);
  });
}
// CS cùng team với `name`, bỏ chính họ + người cũng đang nghỉ ngày ymd (không chia cho người vắng). Không thuộc team nào → [].
function clPeers_(teams, name, leaves, ymd){
  var k = clKey_(name), seen = {}, out = [];
  (teams || []).forEach(function(t){
    var all = clSplit_((t.leader || '') + ',' + (t.members || []).join(','));
    if (!all.some(function(n){ return clKey_(n) === k; })) return;
    all.forEach(function(n){ var nk = clKey_(n); if (nk === k || seen[nk] || clIsOnLeave_(leaves, n, ymd)) return; seen[nk] = 1; out.push(n); });
  });
  return out.sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}
// Thay tên `from` bằng `to` trong chuỗi CS ghi gộp; không trùng tên, giữ thứ tự. "Oanh, Thúy" + Oanh→Mai = "Mai, Thúy"; Mai đã có sẵn → "Thúy, Mai" không lặp.
function clReplaceName_(csStr, from, to){
  var fk = clKey_(from), tk = clKey_(to), out = [], seen = {};
  clSplit_(csStr).forEach(function(n){
    var nk = clKey_(n), v = nk === fk ? to : n, vk = clKey_(v);
    if (seen[vk]) return; seen[vk] = 1; out.push(v);
  });
  if (!seen[tk]) out.push(to);
  return out.join(', ');
}
// Chia danh sách SĐT. mode 'to' → hết cho target. mode 'even' → luân phiên, người đang ít khách nhất nhận trước
// (load = số khách hiện có, nếu có) → đều nhất có thể, kết quả cố định (không ngẫu nhiên) nên chạy lại ra y hệt.
function clAssign_(phones, mode, target, peers, load){
  var out = [], list = (phones || []).slice();
  if (mode === 'to'){ if (!target) return out; list.forEach(function(p){ out.push({ phone: p, to: target }); }); return out; }
  if (!peers || !peers.length) return out;
  var cnt = {}; peers.forEach(function(n){ cnt[n] = (load && load[n]) || 0; });
  list.forEach(function(p){
    var best = peers[0]; peers.forEach(function(n){ if (cnt[n] < cnt[best]) best = n; });
    cnt[best]++; out.push({ phone: p, to: best });
  });
  return out;
}
// Kế hoạch giao lại cho 1 kỳ nghỉ. resp(it) = CS chịu trách nhiệm của lịch (ở web: _schedResponsibleCS).
// Trả { rows:[{phone,from,to,prevCs}], noTarget:bool, peers:[...], skipped:{lý do:số lịch} }.
function clPlan_(leave, schedules, careData, resp, teams, leaves, today, load){
  var res = { rows: [], noTarget: false, peers: [], skipped: {} };
  var nk = clKey_(leave && leave.name); if (!nk) return res;
  var phones = [], seen = {};
  (schedules || []).forEach(function(it){
    if (it.done) return;
    if (it.autoDao || it.type === 'birthday'){ var k = it.autoDao ? 'lịch tự động' : 'sinh nhật'; res.skipped[k] = (res.skipped[k] || 0) + 1; return; }
    if (!clSplit_(resp(it)).some(function(n){ return clKey_(n) === nk; })) return;
    if (seen[it.phone]) return; seen[it.phone] = 1; phones.push(it.phone);
  });
  res.peers = clPeers_(teams, leave.name, leaves, today);
  var target = leave.mode === 'to' ? String(leave.target || '').trim() : '';
  if (leave.mode === 'to' && (!target || clKey_(target) === nk || clIsOnLeave_(leaves, target, today))){ res.noTarget = true; return res; }
  if (leave.mode !== 'to' && !res.peers.length){ res.noTarget = true; return res; }
  clAssign_(phones, leave.mode === 'to' ? 'to' : 'even', target, res.peers, load).forEach(function(a){
    var prev = ((careData || {})[a.phone] || {}).cs || '';
    res.rows.push({ phone: a.phone, from: leave.name, to: a.to, prevCs: prev, newCs: clReplaceName_(prev || leave.name, leave.name, a.to) });
  });
  return res;
}

if (typeof module !== 'undefined' && module.exports){ module.exports = { clIsOnLeave_: clIsOnLeave_, clPeers_: clPeers_, clReplaceName_: clReplaceName_, clAssign_: clAssign_, clPlan_: clPlan_ }; }

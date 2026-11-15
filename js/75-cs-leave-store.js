// ════════════════════════════════════════════════════════════════════
//  R6c-2 (BƯỚC 3+4/4: ÁP DỤNG + LƯU + TRẢ LẠI) — nạp SAU js/73, 74. Lưu kỳ nghỉ + thực sự đổi CS khách.
//  NGUYÊN NHÂN GỐC: bước 2 mới xem trước. Nay: (a) kỳ nghỉ lưu ở biến `_csLeaves` + localStorage `ome_cs_leave` + GAS `setSetting` key `csLeave`
//  (action CÓ SẴN → KHÔNG đổi GAS); (b) giao khách bằng CHÍNH `_applyCareCSToAssigned` của js/07 (đổi careData.cs + careCS + OrderData cột N theo lô
//  + queueCareSync + làm mới bộ lọc) — không viết lại đường ghi; (c) kỳ nghỉ bắt đầu ở TƯƠNG LAI → lưu "hẹn", tự áp dụng khi tới ngày (clApplyDue_,
//  chạy mỗi lần vẽ màn Quá hạn + sau khi nạp từ GAS). Mỗi kỳ nghỉ chỉ áp dụng 1 lần (`applied`). Lưu `handed` [{phone,from,to,prevCs,newCs}] để bước 4 "Trả lại".
//  GIAO HẾT khách (không chỉ khách có lịch) — Duyên chốt 15/11. CS thường đặt nghỉ = "chờ duyệt" (pending), admin/leader duyệt mới giao.
//  Hàm thuần: clGroupRows_, clMergeLeaves_, clDue_ (test: node tools/test-cs-leave-store.js)
// ════════════════════════════════════════════════════════════════════
var _csLeaves = (typeof loadLS === 'function' ? loadLS('ome_cs_leave') : null) || [];

// Gom các dòng giao theo CS mới → entries cho _applyCareCSToAssigned ({csName, phones})
function clGroupRows_(rows){
  var m = {}, order = [];
  (rows || []).forEach(function(r){ if (!m[r.newCs]){ m[r.newCs] = []; order.push(r.newCs); } m[r.newCs].push(r.phone); });
  return order.map(function(k){ return { csName: k, phones: m[k] }; });
}
// Gộp danh sách kỳ nghỉ local + từ GAS theo id (cùng id: bản GAS thắng, trừ khi local đã ended/applied mà GAS chưa → giữ trạng thái "đã làm" để không áp dụng 2 lần)
function clMergeLeaves_(local, remote){
  var by = {}, order = [];
  (local || []).forEach(function(l){ by[l.id] = l; order.push(l.id); });
  (remote || []).forEach(function(r){
    var l = by[r.id];
    if (!l){ by[r.id] = r; order.push(r.id); return; }
    var m = Object.assign({}, r);
    if (l.applied && !r.applied){ m.applied = true; m.handed = l.handed; }
    if (l.ended && !r.ended){ m.ended = true; }
    if (l.handed && l.handed.length && !(m.handed && m.handed.length)) m.handed = l.handed;   // GAS chỉ giữ bản rút gọn (handed nằm ở khoá csLeaveH_*) → giữ danh sách đầy đủ ở máy này
    if (l.pending === false && r.pending){ m.pending = false; m.approvedBy = l.approvedBy; }   // đã duyệt ở máy này mà GAS chưa kịp có
    by[r.id] = m;
  });
  return order.map(function(id){ return by[id]; });
}
// Kỳ nghỉ nào đến hạn áp dụng (đã tới ngày bắt đầu, chưa kết thúc, chưa áp dụng)
function clDue_(leaves, today){
  return (leaves || []).filter(function(l){ return !l.ended && !l.pending && !l.applied && l.from && l.from <= today && (!l.to || today <= l.to); });
}

// Trạng thái kỳ nghỉ: 'cho' (CS đặt, chờ admin/leader duyệt) | 'xong' (đã trả lại/huỷ/từ chối) | 'hen' (chưa tới ngày, chưa giao) | 'het' (qua ngày "đến" mà chưa trả lại → gợi ý Trả lại) | 'dang' (đang nghỉ)
function clStatus_(l, today){
  if (l.ended) return 'xong';
  if (l.pending) return 'cho';
  if (!l.applied && l.from > today) return 'hen';
  if (l.to && l.to < today) return 'het';
  return 'dang';
}
// Kế hoạch TRẢ LẠI: chỉ khách còn đang giữ đúng CS đã giao (newCs) mới trả về prevCs; khách đã bị đổi tay sau đó thì KHÔNG đè.
function clReturnPlan_(l, careData){
  var rows = [], skipped = 0;
  (l.handed || []).forEach(function(h){
    var cur = String(((careData || {})[h.phone] || {}).cs || '').trim().toLowerCase();
    if (cur === String(h.newCs || '').trim().toLowerCase()) rows.push({ phone: h.phone, newCs: h.prevCs || '' }); else skipped++;
  });
  return { rows: rows, skipped: skipped };
}
function clReturnLeave_(l){
  var p = clReturnPlan_(l, careData);
  l.ended = true; l.endedAt = new Date().toISOString(); l.returned = p.rows.length;   // đánh dấu TRƯỚC khi ghi (không trả 2 lần)
  if (p.rows.length && typeof _applyCareCSToAssigned === 'function') _applyCareCSToAssigned(clGroupRows_(p.rows));
  try { if (typeof logAudit === 'function') logAudit('cs_leave', '', l.name, (l.applied ? 'Trả lại ' + p.rows.length + ' khách (bỏ qua ' + p.skipped + ' khách đã đổi tay)' : 'Huỷ kỳ nghỉ hẹn') + ' — ' + l.name); } catch (e) {}
  clSaveLeaves_();
  return p;
}
// Lưu danh sách khách đã giao (handed) gọn: dòng "csCũ<TAB>csMới<TAB>sđt,sđt,…" — gom theo cặp CS để ngắn; cắt khúc ≤40.000 ký tự/khoá vì 1 ô GSheets tối đa 50.000.
function clPackHanded_(handed){
  var g = {}, order = [];
  (handed || []).forEach(function(h){ var k = (h.prevCs || '') + '\t' + (h.newCs || ''); if (!g[k]){ g[k] = []; order.push(k); } g[k].push(h.phone); });
  return order.map(function(k){ return k + '\t' + g[k].join(','); }).join('\n');
}
function clUnpackHanded_(str){
  var out = [];
  String(str || '').split('\n').forEach(function(line){
    var a = line.split('\t'); if (a.length < 3) return;
    a[2].split(',').forEach(function(p){ if (p) out.push({ phone: p, prevCs: a[0], newCs: a[1] }); });
  });
  return out;
}
function clChunk_(str, size){ var out = []; for (var i = 0; i < str.length; i += size) out.push(str.slice(i, i + size)); return out.length ? out : ['']; }
async function clSaveHanded_(l){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  var ch = clChunk_(clPackHanded_(l.handed), 40000); l.hk = ch.length;
  try { for (var i = 0; i < ch.length; i++) await fetch(gsUrl, { method: 'POST', body: JSON.stringify({ action: 'setSetting', key: 'csLeaveH_' + l.id + '_' + i, value: ch[i] }) }); clSaveLeaves_(); }
  catch (e) { if (typeof toast === 'function') toast('❌ Lưu danh sách khách đã giao lên GSheets lỗi: ' + e.message); }
}
// Máy khác (hoặc sau khi xoá cache) chỉ có bản rút gọn → nạp lại handed từ GAS trước khi Trả lại. Trả true nếu có danh sách đầy đủ.
async function clLoadHanded_(l){
  if (l.handed && l.handed.length >= (l.hn || 0)) return true;
  if (typeof gsUrl === 'undefined' || !gsUrl || !l.hk) return !!(l.handed && l.handed.length);
  try {
    var str = '';
    for (var i = 0; i < l.hk; i++){ var r = await fetch(gsUrl + '?action=getSetting&key=csLeaveH_' + encodeURIComponent(l.id) + '_' + i, { redirect: 'follow' }), d = await r.json(); str += (d && d.value) || ''; }
    l.handed = clUnpackHanded_(str); return l.handed.length > 0;
  } catch (e) { return false; }
}
function clPlanFor_(l, today, extraLeaves){
  var all = (_csLeaves || []).filter(function(x){ return x.id !== l.id; }).concat(extraLeaves || [], [l]);
  return clPlan_(l, schedules, careData, typeof _schedResponsibleCS === 'function' ? _schedResponsibleCS : function(){ return ''; }, teams, all, today, typeof clLoad_ === 'function' ? clLoad_() : null, typeof allCustomers !== 'undefined' ? allCustomers : []);
}
async function clSaveLeaves_(){
  try { saveLS('ome_cs_leave', _csLeaves); } catch (e) {}
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  var slim = _csLeaves.map(function(l){ var o = Object.assign({}, l); delete o.handed; return o; });   // handed (có thể hàng nghìn SĐT) để riêng ở csLeaveH_*, tránh vượt 50.000 ký tự/ô
  try { await fetch(gsUrl, { method: 'POST', body: JSON.stringify({ action: 'setSetting', key: 'csLeave', value: JSON.stringify(slim) }) }); }
  catch (e) { if (typeof toast === 'function') toast('❌ Lưu kỳ nghỉ lên GSheets lỗi: ' + e.message); }
}
async function clSyncFromGAS_(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=csLeave', { redirect: 'follow' }), d = await r.json();
    if (d && d.value){ var arr = JSON.parse(d.value); if (Array.isArray(arr)){ _csLeaves = clMergeLeaves_(_csLeaves, arr); try { saveLS('ome_cs_leave', _csLeaves); } catch (e) {} } }
  } catch (e) { /* giữ bản local nếu lỗi mạng/parse */ }
  clApplyDue_();
}
// Giao khách theo kế hoạch của 1 kỳ nghỉ: đánh dấu applied + lưu handed TRƯỚC khi ghi (lỡ lỗi giữa chừng cũng không giao lần 2).
function clApplyLeave_(l, today){
  var p = clPlanFor_(l, today);
  if (p.noTarget) return { ok: false, n: 0, noTarget: true };
  l.applied = true; l.appliedAt = new Date().toISOString(); l.handed = p.rows.map(function(r){ return { phone: r.phone, from: r.from, to: r.to, prevCs: r.prevCs, newCs: r.newCs }; }); l.hn = l.handed.length;
  if (p.rows.length && typeof _applyCareCSToAssigned === 'function') _applyCareCSToAssigned(clGroupRows_(p.rows));
  clSaveHanded_(l);   // không chờ (nền)
  try { if (typeof logAudit === 'function') logAudit('cs_leave', '', l.name, 'Nghỉ ' + l.from + (l.to ? ' → ' + l.to : ' (tạm nghỉ)') + ': giao ' + p.rows.length + ' khách (' + (l.mode === 'to' ? 'chuyển cho ' + l.target : 'chia đều') + ')'); } catch (e) {}
  return { ok: true, n: p.rows.length };
}
function clApplyDue_(){
  if (typeof schedules === 'undefined' || typeof careData === 'undefined' || !schedules.length) return 0;   // lịch chưa tải xong → KHÔNG áp dụng (kẻo đánh dấu applied mà giao 0 khách)
  var today = scYmd_(new Date()), due = clDue_(_csLeaves, today), n = 0;
  due.forEach(function(l){ var r = clApplyLeave_(l, today); if (r.ok) n += r.n; });
  if (due.length){ clSaveLeaves_(); try { if (typeof updateSchedBadges === 'function') updateSchedBadges(); } catch (e) {} }
  return n;
}
if (typeof window !== 'undefined') setTimeout(clSyncFromGAS_, 0);   // nạp kỳ nghỉ từ GAS khi mở CRM (giống _sync*FromGAS ở js/06)
if (typeof module !== 'undefined' && module.exports){ module.exports = { clPackHanded_: clPackHanded_, clUnpackHanded_: clUnpackHanded_, clChunk_: clChunk_, clStatus_: clStatus_, clReturnPlan_: clReturnPlan_, clGroupRows_: clGroupRows_, clMergeLeaves_: clMergeLeaves_, clDue_: clDue_ }; }

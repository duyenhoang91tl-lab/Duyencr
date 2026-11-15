// ════════════════════════════════════════════════════════════════════
//  R6c-2 (BƯỚC 3/4: ÁP DỤNG + LƯU) — nạp SAU js/73, 74. Lưu kỳ nghỉ + thực sự đổi CS khách.
//  NGUYÊN NHÂN GỐC: bước 2 mới xem trước. Nay: (a) kỳ nghỉ lưu ở biến `_csLeaves` + localStorage `ome_cs_leave` + GAS `setSetting` key `csLeave`
//  (action CÓ SẴN → KHÔNG đổi GAS); (b) giao khách bằng CHÍNH `_applyCareCSToAssigned` của js/07 (đổi careData.cs + careCS + OrderData cột N theo lô
//  + queueCareSync + làm mới bộ lọc) — không viết lại đường ghi; (c) kỳ nghỉ bắt đầu ở TƯƠNG LAI → lưu "hẹn", tự áp dụng khi tới ngày (clApplyDue_,
//  chạy mỗi lần vẽ màn Quá hạn + sau khi nạp từ GAS). Mỗi kỳ nghỉ chỉ áp dụng 1 lần (`applied`). Lưu `handed` [{phone,from,to,prevCs,newCs}] để bước 4 "Trả lại".
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
    by[r.id] = m;
  });
  return order.map(function(id){ return by[id]; });
}
// Kỳ nghỉ nào đến hạn áp dụng (đã tới ngày bắt đầu, chưa kết thúc, chưa áp dụng)
function clDue_(leaves, today){
  return (leaves || []).filter(function(l){ return !l.ended && !l.applied && l.from && l.from <= today && (!l.to || today <= l.to); });
}

function clPlanFor_(l, today, extraLeaves){
  var all = (_csLeaves || []).filter(function(x){ return x.id !== l.id; }).concat(extraLeaves || [], [l]);
  return clPlan_(l, schedules, careData, typeof _schedResponsibleCS === 'function' ? _schedResponsibleCS : function(){ return ''; }, teams, all, today, typeof clLoad_ === 'function' ? clLoad_() : null);
}
async function clSaveLeaves_(){
  try { saveLS('ome_cs_leave', _csLeaves); } catch (e) {}
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  try { await fetch(gsUrl, { method: 'POST', body: JSON.stringify({ action: 'setSetting', key: 'csLeave', value: JSON.stringify(_csLeaves) }) }); }
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
  l.applied = true; l.appliedAt = new Date().toISOString(); l.handed = p.rows.map(function(r){ return { phone: r.phone, from: r.from, to: r.to, prevCs: r.prevCs, newCs: r.newCs }; });
  if (p.rows.length && typeof _applyCareCSToAssigned === 'function') _applyCareCSToAssigned(clGroupRows_(p.rows));
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
if (typeof module !== 'undefined' && module.exports){ module.exports = { clGroupRows_: clGroupRows_, clMergeLeaves_: clMergeLeaves_, clDue_: clDue_ }; }

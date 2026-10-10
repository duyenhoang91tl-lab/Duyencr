// ── BÁO CÁO E: HOA HỒNG NHÂN VIÊN ──
// Dùng lại đúng "orders" trả về từ action=salesReportA (đã có sẵn saleBan/giaTriDon) — không
// gọi action riêng ở backend. Tự phân loại đơn ≥15tr/<15tr và tính hoa hồng ở client qua
// _computeCommissionData_() (đã định nghĩa cùng _resolveCommissionRate_/INDIVIDUAL_RATES ở trên).
function renderSalesReportTabE_(wrap, subTabs){
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filters += _quickRangeSelectHtml(_srState.eDateQuick, "_srApplyQuickRange('eDateQuick','eDateFrom','eDateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.eDateFrom)+'" onchange="_srSetField(\'eDateFrom\',this.value);_srState.eDateQuick=\'custom\'" title="Từ ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.eDateTo)+'" onchange="_srSetField(\'eDateTo\',this.value);_srState.eDateQuick=\'custom\'" title="Đến ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  if (_srIsAdmin()){
    filters += _srComboHtml('sr-sale-combo-e', 'eSale', 'saleBOptions', 'Lọc theo Sale', '🔍 Tìm & chọn sale...', 190, true);
    filters += _srComboHtml('sr-team-combo-e', 'eTeam', 'teamOptions', 'Lọc theo Team', '🔍 Tìm & chọn team...', 190, true);
  } else if (currentUser.role === 'leader' && (_srState.leaderTeamOptions||[]).length){
    filters += _srComboHtml('sr-sale-combo-e', 'eSale', 'leaderTeamOptions', 'Lọc theo tên (team của bạn)', '🔍 Tìm tên trong team...', 190, true);
    filters += '<button class="btn sm" title="Xem lại hoa hồng của cả team (bỏ hết lựa chọn riêng)" onclick="_srState.eSale=_srState.leaderTeamOptions.slice();_srState.eSaleCustomized=false;_srApply()">🔄 Cả team</button>';
  } else {
    filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
      '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.eSale||[]).join(', ') || currentUser.name)+' — chỉ xem được hoa hồng của mình</div></div>';
  }
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  if (_srIsAdmin()) filters += '<div class="gear-menu">'+
      '<button class="btn sm" onclick="_srToggleGearMenu(event,\'sr-gear-e\')">⚙ Cài đặt</button>'+
      '<div class="gear-menu-list" id="sr-gear-e" onclick="event.stopPropagation()">'+
        '<div onclick="closeGearMenus();openIndividualRatesModal()">⚙ % hoa hồng cá nhân</div>'+
        '<div onclick="closeGearMenus();openBonusProgramsModal()">🏆 Chương trình thưởng</div>'+
        '<div onclick="closeGearMenus();openSaleChannelsModal()">🏷️ Phân loại đội Sale</div>'+
        '<div onclick="closeGearMenus();openGoldUnitModal()">💰 Đơn giá vàng (Pancake AI)</div>'+
        '<div onclick="closeGearMenus();openChannelRatesModal()">📡 % hoa hồng theo Kênh</div>'+
      '</div></div>';
  filters += '</div>';

  var body = _srState.loading
    ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>'
    : _srRenderE_(_srState.dataE);

  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + filters + body;
}

// ── Tính CHƯƠNG TRÌNH THƯỞNG cho các đơn đang lọc (dùng CHUNG d.orders với phần hoa hồng ở trên) ──
// Quy ước CẬP NHẬT theo văn bản "Cơ chế thưởng kích hoạt Sale mới" (24/09/2026): trong CÙNG 1
// NHÓM cơ chế (VD nhiều bậc "số đơn/ngày", hoặc nhiều mốc "doanh số/ngày") thì chỉ lấy đúng 1
// mức CAO NHẤT đạt được (không cộng dồn trong cùng nhóm). NHƯNG giữa 2 nhóm KHÁC NHAU trong cùng
// phạm vi "theo ngày" (số đơn/ngày VS doanh số/ngày VS đơn đầu tiên/ngày) thì CỘNG DỒN với nhau —
// đúng ví dụ trong văn bản: 5 đơn (100k, bậc số đơn) + 55 triệu (50k, mốc doanh số) = 150k.
// "Theo ĐƠN" (giá trị đơn, sản phẩm) vẫn tách riêng như cũ — 1 sale có thể vừa nhận thưởng theo
// ngày vừa nhận thưởng theo từng đơn trong ngày đó (khác phạm vi hoàn toàn).
function _bonusProgramApplies_(p, dateStr, channel, saleName){
  if (p.dateFrom && dateStr && dateStr < p.dateFrom) return false;
  if (p.dateTo && dateStr && dateStr > p.dateTo) return false;
  var aud = (p.sources && p.sources.length) ? {} : (p.audience || {});   // CT theo NGUỒN áp dụng chung Online + Offline (bỏ qua ô đối tượng)
  if (aud.online || aud.offline){
    if (!channel) return false; // sale chưa được phân loại Online/Offline -> CT có giới hạn đối tượng chưa áp dụng
    if (channel === 'online' && !aud.online) return false;
    if (channel === 'offline' && !aud.offline) return false;
    // CT giới hạn Online/Offline là CT dành cho Sale CHÍNH THỨC — Sale đang ở trạng thái "Thử
    // việc (TV)" (channel==='probation') không tự động được tính, dù audience không tích rõ cả
    // 2 ô online/offline để loại riêng mục này. Thưởng cho Sale thử việc dùng cơ chế riêng
    // ("Giới hạn theo ngày thử việc" bên dưới), không lẫn vào CT chính thức.
    if (channel === 'probation') return false;
  }
  // Giới hạn theo "ngày thứ mấy kể từ Ngày bắt đầu" của TỪNG Sale (VD chương trình thử việc:
  // Giai đoạn 1 = ngày 1-3, Giai đoạn 2 = từ ngày 4). "Ngày bắt đầu" đặt riêng từng Sale ở
  // 👤 Quản lý tài khoản. Sale chưa được đặt Ngày bắt đầu -> KHÔNG áp dụng các CT có bật mục này.
  if (p.probationDay && p.probationDay.enabled){
    var sd = _saleStartDate_(saleName);
    if (!sd) return false;
    var dayNum = _daysSinceStart_(sd, dateStr);
    if (dayNum === null || dayNum < 1) return false;
    var from = (p.probationDay.from !== '' && p.probationDay.from != null) ? Number(p.probationDay.from) : 1;
    var to = (p.probationDay.to !== '' && p.probationDay.to != null) ? Number(p.probationDay.to) : Infinity;
    if (dayNum < from || dayNum > to) return false;
  }
  return true;
}
// Chuyển "dd/MM/yyyy" hoặc "dd/MM/yyyy HH:mm" (định dạng ngày của DT TỔNG) sang "yyyy-MM-dd" để
// so sánh đúng với dateFrom/dateTo (input type=date, vốn luôn là "yyyy-MM-dd") — trước đây so
// sánh thẳng 2 định dạng khác nhau bằng chuỗi (< / >) là SAI, tình cờ ít bị phát hiện.
function _ddmmyyyyToYmd_(s){
  var m = String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  var d = ('0'+m[1]).slice(-2), mo = ('0'+m[2]).slice(-2), y = m[3];
  return y+'-'+mo+'-'+d;
}
// Số ngày kể từ "Ngày bắt đầu" (yyyy-MM-dd) đến 1 ngày cụ thể (yyyy-MM-dd) — ngày bắt đầu = ngày
// thứ 1. Cả 2 tham số PHẢI đã ở dạng "yyyy-MM-dd" (dùng _ddmmyyyyToYmd_ để quy đổi trước khi gọi).
function _daysSinceStart_(startYmd, dateYmd){
  var s = String(startYmd||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  var d = String(dateYmd||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!s || !d) return null;
  var sMs = Date.UTC(+s[1], +s[2]-1, +s[3]);
  var dMs = Date.UTC(+d[1], +d[2]-1, +d[3]);
  return Math.round((dMs - sMs) / 86400000) + 1;
}
// Tra "Ngày bắt đầu" đã đặt cho 1 tên Sale (qua Quản lý tài khoản — 1 tài khoản có thể có nhiều
// tên/bí danh, xem _acctNamesOf) — dùng chung nguồn "accounts" (đã tải sẵn toàn cục).
function _saleStartDate_(name){
  if (!name || typeof accounts === 'undefined') return '';
  for (var i = 0; i < accounts.length; i++){
    if (_acctNamesOf(accounts[i]).indexOf(name) !== -1) return accounts[i].startDate || '';
  }
  return '';
}
// Ước lượng số lượng sản phẩm khớp từ khoá trong ô "Sản phẩm" (văn bản tự do, vd "Tỳ hưu x2, Vòng tay x1")
// — tìm dạng "x2"/"×2"/"(2)" ngay sau từ khoá, không thấy thì tính là 1. Đây là ƯỚC LƯỢNG, hiển thị
// kèm nguyên văn ô sản phẩm để kế toán đối chiếu lại, KHÔNG nên dùng để tự động chi tiền hàng loạt
// mà không kiểm tra khi số tiền lớn.
function _bonusProductQty_(sanPham, keywordsStr){
  var text = String(sanPham||'').toLowerCase();
  var kws = String(keywordsStr||'').split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length || !text) return {matched:false, qty:0};
  var totalQty = 0, matched = false;
  kws.forEach(function(kw){
    if (!kw) return;
    var idx = 0;
    while (true){
      var pos = text.indexOf(kw, idx);
      if (pos === -1) break;
      matched = true;
      var tail = text.substr(pos+kw.length, 10);
      var m = tail.match(/^[\s]*[x×][\s]*([0-9]+)/) || tail.match(/^[\s]*\(([0-9]+)\)/);
      totalQty += m ? (parseInt(m[1],10)||1) : 1;
      idx = pos + kw.length;
    }
  });
  return {matched:matched, qty:totalQty};
}
// Tập tên sale THAM GIA đơn (đều được xét thưởng). Quy tắc hiện hành (Duyên 08/10/2026): đơn đạt quy tắc thưởng thì TIỀN THƯỞNG
// CHIA ĐỀU cho các sale tham gia (VD 2 sale cùng bán nhẫn Tour 21tr5 được 100.000 → mỗi người 50.000). Người tạo đơn Base
// không còn là điều kiện (quy tắc "chỉ người tạo" 07/10 đã thay thế).
function _bonusNamesOfOrder_(o){
  var set = {};
  splitMulti_(o.saleBan, ',').forEach(function(n){ if (n) set[n] = true; });
  return set;
}
// Doanh thu CHIA cho từng sale của 1 đơn — cùng quy ước với _computeCommissionData_ (saleShares nếu đơn ghép Base,
// ngược lại chia đều theo thẻ sale; saleRatio 0.3 = đơn Quầy 30/70).
function _orderRevenueShares_(o){
  var giaTri = Number(o.giaTriDon)||0, ratio = Number(o.saleRatio)||1, out = [];
  if (o.saleShares && o.saleShares.length){
    o.saleShares.forEach(function(x){ if (x.name) out.push({name:x.name, share:giaTri*(Number(x.frac)||0)*ratio}); });
  } else {
    var list = splitMulti_(o.saleBan, ',').filter(Boolean);
    list.forEach(function(n){ out.push({name:n, share:giaTri/list.length*ratio}); });
  }
  return out;
}
// ── Thưởng theo NGUỒN đơn + theo SẢN PHẨM (mã) — thêm 2026-10-10 theo yêu cầu Duyên ──
// p.sources = [tên nguồn đơn] : chương trình CHỈ tính các đơn có "Nguồn đơn" nằm trong danh sách (không phân biệt hoa/thường), áp dụng CHUNG
//   Online + Offline (không xét audience). Cơ chế tính (bậc số đơn/ngày, doanh số, đơn đầu tiên, tiền thưởng) tạo như mọi chương trình khác;
//   các mốc "theo ngày" chỉ cộng dồn các đơn thuộc nguồn đã chọn.
// p.prodRules = {enabled, items:[{code,name,amount}]} : thưởng theo TỪNG sản phẩm (khớp theo MÃ ở cột Mã sản phẩm, ghép vị trí với cột Số lượng):
//   mỗi đơn được amount × số lượng của từng mã đã tích. Các chương trình sản phẩm KHÔNG ghi đè nhau (cộng dồn, mỗi chương trình 1 dòng).
function _bonusNormSrc_(v){ return String(v==null?'':v).trim().toLowerCase(); }
function _bonusSourceOk_(p, nguonDon){
  var list = (p && p.sources) || [];
  if (!list.length) return true;
  var s = _bonusNormSrc_(nguonDon);
  return list.some(function(x){ return _bonusNormSrc_(x) === s; });
}
// Gom theo MÃ: [{code, qty}] từ cột Mã sản phẩm (';') ghép vị trí với Số lượng (',') — cùng quy ước buildSalesReportB_ ở GAS.
function _bonusOrderProductQtys_(o){
  var codes = splitMulti_(o.maSanPham, ';'), qtys = splitMulti_(o.soLuong, ','), out = {};
  codes.forEach(function(c, i){
    c = String(c||'').trim(); if (!c) return;
    var q = Number(String(qtys[i]||'0').replace(',', '.')) || 0;
    var k = c.toLowerCase(); out[k] = (out[k] || 0) + q;
  });
  return out;
}
function _bonusAggSources_(g, sources){
  var agg = {name:g.name, date:g.date, revenue:0, count:0, firstOrderTime:null};
  (sources||[]).forEach(function(sn){
    var x = g.bySrc && g.bySrc[_bonusNormSrc_(sn)]; if (!x) return;
    agg.revenue += x.revenue; agg.count += x.count;
    if (x.firstOrderTime && (agg.firstOrderTime===null || x.firstOrderTime < agg.firstOrderTime)) agg.firstOrderTime = x.firstOrderTime;
  });
  return agg;
}
function _computeBonusData_(orders){
  orders = orders || [];
  var bySale = {};
  function ensure(name){ if (!bySale[name]) bySale[name] = {total:0, items:[]}; return bySale[name]; }

  // Gom theo (sale, ngày) để chấm các CT phạm vi "theo ngày" — kèm giờ:phút của đơn SỚM NHẤT
  // trong ngày (dùng cho CT "Đơn đầu tiên trong ngày").
  var bySaleDay = {};
  // THƯỞNG 2026-10-10: ngày tính thưởng = NGÀY TẠO ĐƠN TRÊN BASE (o.baseNgayTao); doanh thu NGÀY chỉ lấy ĐƠN GỐC (ghi chú Pos là mã bộ đếm sạch
  // dạng 17T10/2026, đã ghép Base). Backend cũ chưa trả baseNgayTao/donGoc → giữ cách cũ (tránh doanh thu ngày = 0 khi chưa deploy GAS).
  var _hasGocField = orders.some(function(o){ return !!o.baseNgayTao; });
  function _bonusYmd_(o){ return o.baseNgayTao || _ddmmyyyyToYmd_(o.ngayTao); }
  orders.forEach(function(o){
    var dateStr = _bonusYmd_(o);
    var timeMatch = String(o.ngayTao||'').match(/(\d{1,2}):(\d{2})/);
    var timeStr = timeMatch ? timeMatch[0] : '';
    // Mọi sale tham gia đều tính số đơn/đơn đầu tiên trong ngày; doanh thu ngày dùng phần CHIA của từng sale.
    var bonusSet = _bonusNamesOfOrder_(o);
    var revShares = (_hasGocField && !o.donGoc) ? [] : _orderRevenueShares_(o); // [{name, share}] — doanh thu CHIA theo sale; đơn KHÔNG phải đơn gốc: không cộng vào doanh thu ngày
    var perName = {};
    revShares.forEach(function(x){ perName[x.name] = {share:x.share, bonus:false}; });
    Object.keys(bonusSet).forEach(function(nm){ if (!perName[nm]) perName[nm] = {share:0, bonus:true}; else perName[nm].bonus = true; });
    Object.keys(perName).forEach(function(name){
      if (!name) return;
      var key = name+'|'+dateStr;
      if (!bySaleDay[key]) bySaleDay[key] = {name:name, date:dateStr, revenue:0, count:0, firstOrderTime:null, bySrc:{}};
      var _sk = _bonusNormSrc_(o.nguonDon), _sg = bySaleDay[key].bySrc[_sk] || (bySaleDay[key].bySrc[_sk] = {revenue:0, count:0, firstOrderTime:null});   // cộng riêng theo NGUỒN cho CT có p.sources
      bySaleDay[key].revenue += perName[name].share; _sg.revenue += perName[name].share;
      if (perName[name].bonus){
        bySaleDay[key].count++; _sg.count++;
        if (timeStr && (bySaleDay[key].firstOrderTime===null || timeStr < bySaleDay[key].firstOrderTime)) bySaleDay[key].firstOrderTime = timeStr;
        if (timeStr && (_sg.firstOrderTime===null || timeStr < _sg.firstOrderTime)) _sg.firstOrderTime = timeStr;
      }
    });
  });
  Object.keys(bySaleDay).forEach(function(key){
    var g = bySaleDay[key];
    var channel = SALE_CHANNELS[g.name] || '';
    // 3 nhóm riêng theo phạm vi "theo ngày" — CỘNG DỒN giữa các nhóm, trong 1 nhóm chỉ lấy cao nhất.
    var bestTier = null, bestRevDay = null, bestFirstOrder = null;
    BONUS_PROGRAMS.forEach(function(p){
      if (!_bonusProgramApplies_(p, g.date, channel, g.name)) return;
      var gs = (p.sources && p.sources.length) ? _bonusAggSources_(g, p.sources) : g;   // CT theo nguồn: chỉ cộng đơn thuộc nguồn đã chọn
      if (p.sources && p.sources.length && gs.count === 0 && gs.revenue === 0) return;   // ngày không có đơn nào thuộc nguồn đã chọn
      var srcTxt = (p.sources && p.sources.length) ? ' [nguồn: '+p.sources.join(', ')+']' : '';
      if (p.revenue && p.revenue.enabled && p.revenue.scope === 'day'){
        var min = (p.revenue.min!=='' && p.revenue.min!=null) ? Number(p.revenue.min) : null;
        var max = (p.revenue.max!=='' && p.revenue.max!=null) ? Number(p.revenue.max) : null;
        if ((min===null || gs.revenue>=min) && (max===null || gs.revenue<=max)){
          var amt = Number(p.bonusAmount)||0;
          if (amt>0 && (!bestRevDay || amt>bestRevDay.amount)) bestRevDay = {amount:amt, program:p, detail:'Doanh số ngày '+_srMoney(gs.revenue)+srcTxt};
        }
      }
      if (p.tier && p.tier.enabled && (p.tier.rows||[]).length && gs.count>0){
        var hit = null;
        p.tier.rows.slice().sort(function(a,b){ return Number(a.count)-Number(b.count); }).forEach(function(t){
          if (gs.count >= Number(t.count)) hit = t;
        });
        if (hit){
          var amt2 = Number(hit.bonus)||0;
          if (amt2>0 && (!bestTier || amt2>bestTier.amount)) bestTier = {amount:amt2, program:p, detail:'Đạt '+gs.count+' đơn/ngày (bậc từ '+hit.count+' đơn)'+srcTxt};
        }
      }
      if (p.firstOrder && p.firstOrder.enabled && gs.count>0){
        var amt3 = Number(p.firstOrder.amount)||0;
        if (amt3>0 && (!bestFirstOrder || amt3>bestFirstOrder.amount)) bestFirstOrder = {amount:amt3, program:p, detail:'Đơn đầu tiên trong ngày'+(gs.firstOrderTime?' (lúc '+gs.firstOrderTime+')':'')+srcTxt};
      }
    });
    [[bestTier,'Theo ngày (số đơn)'], [bestRevDay,'Theo ngày (doanh số)'], [bestFirstOrder,'Theo ngày (đơn đầu tiên)']].forEach(function(pair){
      var best = pair[0]; if (!best) return;
      var rec = ensure(g.name);
      rec.total += best.amount;
      rec.items.push({date:g.date, scope:pair[1], program:best.program.name, amount:best.amount, detail:best.detail});
    });
  });

  // Chấm các CT phạm vi "theo đơn" (giá trị đơn / sản phẩm)
  var review = [];   // đơn cần kiểm tra tay (mã SP chưa xác nhận, đơn vòng thiếu doanh thu dòng...) — hiện ở tab "Chi tiết thưởng"
  orders.forEach(function(o){
    var dateStr = _bonusYmd_(o);
    var giaTri = Number(o.giaTriDon)||0;
    var binfo = _bcOrderInfo_(o);   // đếm sản phẩm + phần vòng/charm mix (27-fn-bonuscore.js)
    if (binfo.needReview && (!_hasGocField || o.donGoc)) review.push({ date:dateStr, counter:binfo.counter, ghiChu:String(o.ghiChu||''), reasons:binfo.reasons, sale:String(o.saleBan||'') });
    var orderNames = Object.keys(_bonusNamesOfOrder_(o)).filter(Boolean), nParts = orderNames.length || 1;
    orderNames.forEach(function(name){ // mọi sale tham gia; tiền thưởng chia đều nParts
      if (!name) return;
      var channel = SALE_CHANNELS[name] || '';
      var best = null;
      var extra = [];   // CT thưởng theo SẢN PHẨM (mã): cộng dồn, không tranh "best" với CT khác
      BONUS_PROGRAMS.forEach(function(p){
        if (!_bonusProgramApplies_(p, dateStr, channel, name)) return;
        if (!_bonusSourceOk_(p, o.nguonDon)) return;   // CT theo nguồn: bỏ đơn ngoài danh sách nguồn
        if (p.prodRules && p.prodRules.enabled && (p.prodRules.items||[]).length){
          var pq2 = _bonusOrderProductQtys_(o), tot = 0, parts = [];
          p.prodRules.items.forEach(function(it){
            var q = pq2[_bonusNormSrc_(it.code)] || 0, a = Number(it.amount)||0;
            if (q>0 && a>0){ tot += a*q; parts.push((it.name||it.code)+' ×'+q); }
          });
          if (tot>0) extra.push({amount:tot, program:p, detail:'Sản phẩm: '+esc(parts.join('; '))});
        }
        if (p.product && p.product.trim()){
          var pq = _bonusProductQty_(o.sanPham, p.product);
          if (pq.matched && pq.qty>0){
            var amt = (Number(p.bonusAmount)||0) * pq.qty;
            if (amt>0 && (!best || amt>best.amount)) best = {amount:amt, program:p, detail:'SL ước tính: '+pq.qty+' — SP trên đơn: "'+esc(o.sanPham||'')+'"'};
          }
        }
        if (p.revenue && p.revenue.enabled && p.revenue.scope === 'order'){
          var min = (p.revenue.min!=='' && p.revenue.min!=null) ? Number(p.revenue.min) : null;
          var max = (p.revenue.max!=='' && p.revenue.max!=null) ? Number(p.revenue.max) : null;
          var isVongP = _bcIsVongProgram_(p), minSP = _bcMinProducts_(p), measured = giaTri, dtl = 'Giá trị đơn '+_srMoney(giaTri);
          var okP = true;
          if (isVongP){   // Bill vòng mix charm: mốc tính trên PHẦN VÒNG + CHARM MIX, đơn phải là đơn vòng
            okP = binfo.hasVong && binfo.vongRev !== null;
            measured = binfo.vongRev; dtl = 'Phần vòng + charm mix '+_srMoney(binfo.vongRev||0)+' (đơn '+_srMoney(giaTri)+')';
          } else {
            okP = _bonusRequireProductOk_(p, o.sanPham);
            var rk = _bcRequireKw_(p);
            if (rk && p.requireProduct === undefined) okP = _bonusRequireProductOk_({requireProduct: rk}, o.sanPham);
            if (minSP > 0){ okP = okP && binfo.nProducts >= minSP; dtl += ' — '+binfo.nProducts+' sản phẩm'; }
          }
          if (okP && (min===null || measured>=min) && (max===null || measured<=max)){
            var amt2 = Number(p.bonusAmount)||0;
            if (amt2>0 && (!best || amt2>best.amount)) best = {amount:amt2, program:p, detail:dtl};
          }
        }
      });
      extra.forEach(function(ex){
        var recX = ensure(name), partX = Math.round(ex.amount / nParts);
        recX.total += partX;
        recX.items.push({date:dateStr, scope:'Theo sản phẩm', program:ex.program.name, amount:partX, detail:ex.detail+(nParts>1 ? ' — thưởng '+_srMoney(ex.amount)+' chia đều '+nParts+' sale' : ''), orderId:o.id, maDonPos:String(o.ghiChu||'')});
      });
      if (best){
        var rec = ensure(name);
        var part = Math.round(best.amount / nParts); // chia đều cho các sale tham gia
        rec.total += part;
        rec.items.push({date:dateStr, scope:'Theo đơn', program:best.program.name, amount:part, detail:best.detail+(nParts>1 ? ' — thưởng '+_srMoney(best.amount)+' chia đều '+nParts+' sale' : ''), orderId:o.id, maDonPos:String(o.ghiChu||'')});
      }
    });
  });

  var rows = Object.keys(bySale).map(function(name){
    var r = bySale[name];
    r.items.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    return {name:name, total:r.total, items:r.items};
  }).sort(function(a,b){ return b.total-a.total; });
  return {bySale: rows, total: rows.reduce(function(s,r){ return s+r.total; },0), review: review};
}

function _srRenderE_(d){
  if (!d) return _srNoDataHtml_();
  var c = _computeCommissionData_(d.orders || []);
  var html = '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">'+
    'Ngưỡng phân loại đơn: <b>'+_srMoney(COMMISSION_THRESHOLD)+'</b> — đơn từ mức này trở lên tính "≥15tr", thấp hơn tính "&lt;15tr". '+
    'Doanh thu của mỗi người trong 1 đơn = <b>giá trị đơn ÷ số sale đứng tên trên đơn đó</b> (chia đều).</div>';

  // a) Doanh thu tổng theo mức đơn hàng
  html += '<div class="dash-section-title">a) Doanh thu theo mức đơn hàng'+_srViewToggleHtml('eBucketView')+'</div>';
  if (_srState.eBucketView === 'table'){
    html += '<div class="kpi-grid" style="margin-bottom:16px">' +
      '<div class="kpi-card" style="border:1.5px solid var(--text)"><div class="kpi-val">'+_srMoney(c.totalRevenueAbove15+c.totalRevenueBelow15+c.totalRevenueChannel)+'</div><div class="kpi-label"><b>Tổng doanh thu</b></div></div>' +
      '<div class="kpi-card"><div class="kpi-val">'+fmt(c.totalOrdersAbove15)+'</div><div class="kpi-label">Số đơn ≥15tr</div></div>' +
      '<div class="kpi-card"><div class="kpi-val">'+fmt(c.totalOrdersBelow15)+'</div><div class="kpi-label">Số đơn &lt;15tr</div></div>' +
      '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_srMoney(c.totalRevenueAbove15)+'</div><div class="kpi-label">Doanh thu đơn ≥15tr</div></div>' +
      '<div class="kpi-card"><div class="kpi-val">'+_srMoney(c.totalRevenueBelow15)+'</div><div class="kpi-label">Doanh thu đơn &lt;15tr</div></div>' +
      (c.totalOrdersChannel ? '<div class="kpi-card"><div class="kpi-val">'+_srMoney(c.totalRevenueChannel)+'</div><div class="kpi-label">DT kênh % riêng ('+fmt(c.totalOrdersChannel)+' đơn)</div></div>' : '') +
      '</div>';
  } else {
    var bucketRows = [
      { name: 'Đơn ≥15tr', value: c.totalRevenueAbove15, orders: c.totalOrdersAbove15 },
      { name: 'Đơn <15tr', value: c.totalRevenueBelow15, orders: c.totalOrdersBelow15 }
    ];
    if (c.totalOrdersChannel) bucketRows.push({ name: 'Kênh % riêng', value: c.totalRevenueChannel, orders: c.totalOrdersChannel });
    html += _srChartSvg(bucketRows, 'name', 'value', _srState.eBucketView, true, 'orders');
  }

  // b) Hoa hồng từng nhân viên
  _SR_COLTH_ROWSFN_['eSale'] = function(){ return _computeCommissionData_((_srState.dataE&&_srState.dataE.orders)||[]).bySale || []; };
  _SR_COLTH_GETTER_['eSale'] = { name: function(r){ return r.name; } };
  var rows = _srApplyColFilters_(c.bySale||[], 'eSale', _SR_COLTH_GETTER_['eSale']).filter(function(s){ return !_srState.eSaleSearch || s.name.toLowerCase().indexOf(_srState.eSaleSearch.toLowerCase())!==-1; });
  html += '<div class="dash-section-title">b) Hoa hồng nhân viên <span style="font-weight:400;color:var(--muted);font-size:11px">(doanh thu = phần chia đều của người đó trong từng đơn)</span>'+_srViewToggleHtml('eSaleView')+'</div>';
  html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên sale..." value="'+esc(_srState.eSaleSearch)+'" oninput="_srState.eSaleSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
  if (_srState.eSaleView === 'table'){
    html += '<table class="dash-table"><thead><tr>'+
      _srColTh_('eSale','name','Sale',_SR_COLTH_ROWSFN_['eSale'],_SR_COLTH_GETTER_['eSale'].name)+'<th style="text-align:right">Số đơn ≥15tr</th><th style="text-align:right">Số đơn &lt;15tr</th>'+
      '<th style="text-align:right">DT ≥15tr</th><th style="text-align:right">DT &lt;15tr</th>'+
      '<th style="text-align:right">% ≥15tr</th><th style="text-align:right">% &lt;15tr</th>'+
      '<th style="text-align:right">DT kênh riêng</th>'+
      '<th style="text-align:right"><b>Hoa hồng</b></th></tr></thead><tbody>';
    rows.forEach(function(s){
      var chTitle = s.channelBreakdown && Object.keys(s.channelBreakdown).length
        ? Object.keys(s.channelBreakdown).map(function(k){ var cb=s.channelBreakdown[k]; return k+': '+_srMoney(cb.revenue)+' × '+cb.rate+'%'; }).join(' | ')
        : '';
      html += '<tr><td>'+esc(s.name)+'</td>'+
        '<td style="text-align:right">'+fmt(s.ordersAbove15)+'</td>'+
        '<td style="text-align:right">'+fmt(s.ordersBelow15)+'</td>'+
        '<td style="text-align:right">'+_srMoney(s.revenueAbove15)+'</td>'+
        '<td style="text-align:right">'+_srMoney(s.revenueBelow15)+'</td>'+
        '<td style="text-align:right" title="Nguồn: '+esc(s.sourceAbove15)+'">'+s.rateAbove15+'%</td>'+
        '<td style="text-align:right" title="Nguồn: '+esc(s.sourceBelow15)+'">'+s.rateBelow15+'%</td>'+
        '<td style="text-align:right"'+(chTitle?(' title="'+esc(chTitle)+'"'):'')+'>'+(s.channelRevenue ? _srMoney(s.channelRevenue) : '—')+'</td>'+
        '<td style="text-align:right"><b>'+_srMoney(s.commission)+'</b></td></tr>';
    });
    if (!rows.length) html += '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    else html += _srTotalRowHtml_(['Tổng',
      fmt(rows.reduce(function(s,r){return s+(r.ordersAbove15||0);},0)),
      fmt(rows.reduce(function(s,r){return s+(r.ordersBelow15||0);},0)),
      _srMoney(rows.reduce(function(s,r){return s+(r.revenueAbove15||0);},0)),
      _srMoney(rows.reduce(function(s,r){return s+(r.revenueBelow15||0);},0)),
      '', '',
      _srMoney(rows.reduce(function(s,r){return s+(r.channelRevenue||0);},0)),
      '<b>'+_srMoney(c.totalCommission)+'</b>']);
    html += '</tbody></table>';
    html += '<div style="font-size:11px;color:var(--muted);margin-top:6px">Rê chuột vào % để xem nguồn áp dụng (Cá nhân / Team X / Chưa cài).</div>';
  } else {
    html += '<div style="font-size:11px;color:var(--hint);margin-bottom:4px">Vẽ theo "Hoa hồng"</div>';
    html += _srChartSvg(rows, 'name', 'commission', _srState.eSaleView, true);
  }

  // c) Chương trình thưởng — cộng thêm ngoài hoa hồng %, tính theo các chương trình admin đã cài
  var bonus = _computeBonusData_(d.orders || []);
  html += '<div class="dash-section-title" style="margin-top:18px">c) Chương trình thưởng <span style="font-weight:400;color:var(--muted);font-size:11px">(mỗi nhóm cơ chế/ngày — số đơn, doanh số, đơn đầu tiên — chỉ tính mức cao nhất; các nhóm KHÁC NHAU trong cùng ngày được cộng dồn)</span></div>';
  if (!BONUS_PROGRAMS.length){
    html += '<div style="color:var(--muted);font-size:12px;padding:10px 0">Chưa có chương trình thưởng nào — bấm "🏆 Chương trình thưởng" ở trên để thêm.</div>';
  } else {
    _SR_COLTH_ROWSFN_['eBonus'] = function(){ return _computeBonusData_((_srState.dataE&&_srState.dataE.orders)||[]).bySale || []; };
    _SR_COLTH_GETTER_['eBonus'] = { name: function(r){ return r.name; } };
    var bonusRows = _srApplyColFilters_(bonus.bySale, 'eBonus', _SR_COLTH_GETTER_['eBonus']).filter(function(s){ return !_srState.eSaleSearch || s.name.toLowerCase().indexOf(_srState.eSaleSearch.toLowerCase())!==-1; });
    html += '<table class="dash-table"><thead><tr>'+_srColTh_('eBonus','name','Sale',_SR_COLTH_ROWSFN_['eBonus'],_SR_COLTH_GETTER_['eBonus'].name)+'<th style="text-align:right">Số lượt thưởng</th><th style="text-align:right"><b>Tổng thưởng</b></th><th></th></tr></thead><tbody>';
    bonusRows.forEach(function(s, i){
      var rid = 'bn_'+i;
      var expanded = _srState.bonusExpandedRow === rid;
      html += '<tr><td>'+esc(s.name)+(SALE_CHANNELS[s.name] ? ' <span style="font-size:10px;color:var(--muted)">('+(SALE_CHANNELS[s.name]==='online'?'Online':(SALE_CHANNELS[s.name]==='probation'?'Thử việc':'Offline'))+')</span>' : ' <span style="font-size:10px;color:var(--red)">(chưa phân loại)</span>')+'</td>'+
        '<td style="text-align:right">'+fmt(s.items.length)+'</td>'+
        '<td style="text-align:right"><b>'+_srMoney(s.total)+'</b></td>'+
        '<td><button class="btn sm" onclick="_srState.bonusExpandedRow='+(expanded?"''":"'"+rid+"'")+';renderSalesReportTab()">'+(expanded?'Ẩn':'Chi tiết')+'</button></td></tr>';
      if (expanded){
        html += '<tr><td colspan="4" style="background:var(--surface2);padding:8px 14px">'+
          '<table class="dash-table" style="margin:0"><thead><tr><th>Ngày</th><th>Phạm vi</th><th>Chương trình</th><th>Chi tiết</th><th style="text-align:right">Thưởng</th></tr></thead><tbody>'+
          s.items.map(function(it){
            return '<tr><td>'+esc(it.date)+'</td><td>'+esc(it.scope)+'</td><td>'+esc(it.program)+'</td><td style="font-size:11px;color:var(--muted)">'+it.detail+'</td><td style="text-align:right">'+_srMoney(it.amount)+'</td></tr>';
          }).join('')+
          '</tbody></table></td></tr>';
      }
    });
    if (!bonusRows.length) html += '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px">Không có thưởng nào phát sinh trong khoảng lọc</td></tr>';
    else html += _srTotalRowHtml_(['Tổng', '', '<b>'+_srMoney(bonusRows.reduce(function(s,r){return s+r.total;},0))+'</b>', '']);
    html += '</tbody></table>';
    html += '<div style="font-size:11px;color:var(--muted);margin-top:6px">"SL ước tính" ở chương trình theo sản phẩm là ước lượng từ ô mô tả sản phẩm — nên đối chiếu lại trước khi chi nếu số tiền lớn. Chương trình có giới hạn Online/Offline sẽ không áp dụng cho Sale chưa được phân loại (cài ở Quản lý Team).</div>';
  }
  return html;
}

// ════════════════════════════════════════════════════════════════════
//  BÁO CÁO F: TỶ LỆ HOÀN THÀNH KPI THEO SALE — theo yêu cầu Duyên 2026-09.
//  Sale văn phòng (offline) được gán 1 trong 3 BẬC, mỗi bậc 1 mức KPI riêng (mặc định Bậc 1 =
//  400tr, Bậc 2 = 500tr, Bậc 3 = 500tr). Sale online KHÔNG chia bậc, dùng CHUNG 1 mức KPI (mặc
//  định 500tr). Mỗi Sale (bất kể văn phòng/online) có thể đặt 1 mức KPI COMMIT RIÊNG, ưu tiên
//  tuyệt đối hơn bậc/nhóm nếu có đặt. Nhóm (Văn phòng/Online) lấy từ SaleDirectory — cùng nguồn
//  với tab "KPI Pancake". Cấu hình lưu 1 setting duy nhất 'saleKpiConfig', KHÔNG chia theo
//  tháng — sửa là áp dụng ngay, giống hệt cơ chế "% hoa hồng cá nhân" đã có.
// ════════════════════════════════════════════════════════════════════
function renderSalesReportTabF_(wrap, subTabs){
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filters += _quickRangeSelectHtml(_srState.fDateQuick, "_srApplyQuickRange('fDateQuick','fDateFrom','fDateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.fDateFrom)+'" onchange="_srSetField(\'fDateFrom\',this.value);_srState.fDateQuick=\'custom\'" title="Từ ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.fDateTo)+'" onchange="_srSetField(\'fDateTo\',this.value);_srState.fDateQuick=\'custom\'" title="Đến ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  if (_srIsAdmin()){
    filters += _srComboHtml('sr-sale-combo-f', 'fSale', 'saleBOptions', 'Lọc theo Sale', '🔍 Tìm & chọn sale...', 190);
    filters += _srComboHtml('sr-team-combo-f', 'fTeam', 'teamOptions', 'Lọc theo Team', '🔍 Tìm & chọn team...', 190);
  } else if (currentUser.role === 'leader' && (_srState.leaderTeamOptions||[]).length){
    filters += _srComboHtml('sr-sale-combo-f', 'fSale', 'leaderTeamOptions', 'Lọc theo tên (team của bạn)', '🔍 Tìm tên trong team...', 190);
    filters += '<button class="btn sm" title="Xem lại KPI của cả team (bỏ hết lựa chọn riêng)" onclick="_srState.fSale=_srState.leaderTeamOptions.slice();_srState.fSaleCustomized=false;_srApply()">🔄 Cả team</button>';
  } else {
    filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
      '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.fSale||[]).join(', ') || currentUser.name)+' — chỉ xem được KPI của mình</div></div>';
  }
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm" onclick="openSaleKpiConfigModal_()">🎯 Cài đặt KPI (bậc / commit riêng)</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm" onclick="openSaleChannelsModal()">🏷️ Phân loại đội Sale</button>';
  filters += '</div>';

  var body = _srState.loading
    ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>'
    : _srRenderF_(_srState.dataF);

  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + filters + body;
}

function _srRenderF_(d){
  if (!d) return _srNoDataHtml_();
  if (d.error) return '<div style="color:#dc2626;text-align:center;padding:30px">Lỗi: '+esc(d.error)+'</div>';
  var cfg = d.config || {};
  _SR_COLTH_ROWSFN_['fSale'] = function(){ return (_srState.dataF && _srState.dataF.rows) || []; };
  _SR_COLTH_GETTER_['fSale'] = { name: function(r){ return r.name; } };
  var rows = _srApplyColFilters_(d.rows||[], 'fSale', _SR_COLTH_GETTER_['fSale']).filter(function(r){ return !_srState.fSaleSearch || r.name.toLowerCase().indexOf(_srState.fSaleSearch.toLowerCase())!==-1; });

  // Sale thuong (khong phai Admin) CHI duoc xem dung dong cua chinh minh — mac dinh moi tai
  // khoan deu xem duoc tab "Bao cao doanh so" tru khi Admin chu dong gioi han (xem
  // _tabAllowedForUser), nen neu khong thu hep o day thi tung Sale se thay het doanh thu/bac
  // cua ca cong ty. Admin van thay day du nhu cu, khong doi gi.
  var _fIsAdmin = (typeof currentUser!=='undefined' && currentUser && (currentUser.role==='admin'||currentUser.role==='demo'));
  var _fSelfView = !_fIsAdmin;
  if (_fSelfView) {
    var _fMyNames = (typeof currentUser!=='undefined' && currentUser && currentUser.names && currentUser.names.length)
      ? currentUser.names : ((typeof currentUser!=='undefined' && currentUser && currentUser.name) ? [currentUser.name] : []);
    var _fMyNamesLc = _fMyNames.map(function(n){ return String(n).trim().toLowerCase(); });
    rows = rows.filter(function(r){ return _fMyNamesLc.indexOf(String(r.name).trim().toLowerCase())!==-1; });
  }
  function _fTierStatusLabel_(tier){
    if (!tier) return '';
    return (tier==='TVF1' || tier==='TVF2') ? '🔰 Đang thử việc' : '✅ Chính thức';
  }
  // Tong theo DUNG tap dong dang hien (da loc/thu hep o tren) — KHONG dung d.totalRevenue/
  // totalTarget/totalPct truc tiep nua, vi 2 gia tri do luon tinh tren TOAN BO cong ty phia
  // server, se lam lo doanh thu nguoi khac vao the KPI khi 1 Sale thuong dang tu xem minh.
  var fTotalRevenue = rows.reduce(function(s,r){ return s+r.revenue; }, 0);
  var fTotalTarget = rows.reduce(function(s,r){ return s+(r.target||0); }, 0);
  var fTotalPct = fTotalTarget>0 ? Math.round(fTotalRevenue/fTotalTarget*1000)/10 : null;
  // Commit riêng (SỬA 2026-10-04): chạy SONG SONG với KPI theo bậc, KHÔNG thay thế — tính tổng
  // Commit/%HT Commit riêng trên CHÍNH tập "rows" đã lọc self-view ở trên (giống hệt cách
  // fTotalRevenue/fTotalTarget đã làm), tránh lộ số của người khác khi 1 Sale thường tự xem mình.
  var fTotalCommit = rows.reduce(function(s,r){ return s+(r.commit||0); }, 0);
  var fTotalPctCommit = fTotalCommit>0 ? Math.round(fTotalRevenue/fTotalCommit*1000)/10 : null;

  var selfBanner = '';
  if (_fSelfView) {
    if (!rows.length) {
      selfBanner = '<div style="padding:10px 14px;background:var(--surface2);border-radius:8px;margin-bottom:10px;color:var(--muted)">Chưa tìm thấy Bậc KPI gắn với tài khoản của bạn — liên hệ quản trị viên để được gán Bậc bắt đầu.</div>';
    } else {
      selfBanner = rows.map(function(r){
        var statusLabel = _fTierStatusLabel_(r.tier);
        return '<div style="padding:10px 14px;background:var(--surface2);border-radius:8px;margin-bottom:10px">'+
          '<b style="font-size:13px">'+(statusLabel||'<span style=\'color:var(--hint)\'>Chưa gán bậc</span>')+'</b>'+
          (r.tier ? ' — Bậc <b>'+esc(r.tier)+'</b>' : '')+
          '</div>';
      }).join('');
    }
  }

  var tt = cfg.tierTargets || {};
  var noTierCount = (d.rows||[]).filter(function(r){ return r.nhom==='(chưa gán bậc)'; }).length;
  var html = '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">'+
    'Mục tiêu theo bậc (tự động tăng/giảm hàng tháng theo doanh thu, bắt đầu theo dõi từ <b>'+esc(cfg.trackingStartMonth||'')+'</b>): '+
    '<b>F1</b>='+_srMoney(tt.F1)+' · <b>F2</b>='+_srMoney(tt.F2)+' · <b>F3</b>='+_srMoney(tt.F3)+
    ' · <b>O1</b>='+_srMoney(tt.O1)+' · <b>O2</b>='+_srMoney(tt.O2)+' · <b>O3</b>='+_srMoney(tt.O3)+
    ' · <b>O</b> (không nhảy bậc)='+_srMoney(tt.O)+
    ' · <b>Thử việc</b>: TVF1='+_srMoney(tt.TVF1)+', TVF2='+_srMoney(tt.TVF2)+' (luôn đúng 1 tháng; tháng sau TVF1→F1, TVF2→F2 — riêng TVF2→F2 phải 2 tháng đầu MỖI tháng đạt ≥100% KPI F2, không đạt thì xuống F1 làm lại)'+
    ' · Ai có <b>Commit riêng</b> thì xem thêm 2 cột Commit/%HT Commit — chạy SONG SONG với KPI theo bậc (không thay thế).'+
    (!_fSelfView && noTierCount ? ' <b style="color:#9a3412">'+noTierCount+' Sale chưa được gán Bậc bắt đầu — bấm "🎯 Cài đặt KPI" để gán.</b>' : '')+
    '</div>';

  html += selfBanner;
  html += '<div class="kpi-grid" style="margin-bottom:16px">'+
    '<div class="kpi-card" style="border:1.5px solid var(--text)"><div class="kpi-val">'+_srMoney(fTotalRevenue)+'</div><div class="kpi-label"><b>'+(_fSelfView?'Doanh thu của bạn':'Tổng doanh thu')+'</b></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(fTotalTarget)+'</div><div class="kpi-label">'+(_fSelfView?'KPI mục tiêu':'Tổng KPI mục tiêu')+'</div></div>'+
    '<div class="kpi-card" style="border:1.5px solid '+(fTotalPct!==null && fTotalPct>=100 ? '#16a34a' : '#dc2626')+'"><div class="kpi-val" style="color:'+(fTotalPct!==null && fTotalPct>=100 ? '#16a34a' : '#dc2626')+'">'+(fTotalPct===null?'—':fTotalPct+'%')+'</div><div class="kpi-label">% hoàn thành'+(_fSelfView?'':' chung')+'</div></div>'+
    (fTotalCommit ? '<div class="kpi-card" style="border:1.5px solid '+(fTotalPctCommit!==null && fTotalPctCommit>=100 ? '#16a34a' : '#dc2626')+'"><div class="kpi-val" style="color:'+(fTotalPctCommit!==null && fTotalPctCommit>=100 ? '#16a34a' : '#dc2626')+'">'+(fTotalPctCommit===null?'—':fTotalPctCommit+'%')+'</div><div class="kpi-label">% hoàn thành Commit'+(_fSelfView?'':' chung')+'</div></div>' : '')+
    '</div>';

  html += '<div class="dash-section-title">Chi tiết theo Sale'+_srViewToggleHtml('fKpiView')+'</div>';
  html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên sale..." value="'+esc(_srState.fSaleSearch)+'" oninput="_srState.fSaleSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';

  if (_srState.fKpiView === 'table'){
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+
      _srColTh_('fSale','name','Sale',_SR_COLTH_ROWSFN_['fSale'],_SR_COLTH_GETTER_['fSale'].name)+'<th>Nhóm</th><th>Bậc</th><th style="text-align:right">Doanh thu</th>'+
      '<th style="text-align:right">KPI (bậc)</th><th style="text-align:right">%HT KPI</th>'+
      '<th style="text-align:right">Commit riêng</th><th style="text-align:right">%HT Commit</th>'+
      '<th>Kết quả</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var tierLabel = r.tier ? esc(r.tier)+' <span style="font-size:10.5px;color:var(--muted)">('+_fTierStatusLabel_(r.tier)+')</span>' : '<span style="color:var(--hint)">chưa gán</span>';
      var pctColor = r.pct===null ? 'var(--muted)' : (r.pct>=100 ? '#16a34a' : '#dc2626');
      var resultTxt = r.pct===null ? '<span style="color:var(--hint)">chưa có mục tiêu</span>' : (r.pct>=100 ? '✓ Đạt' : '✗ Chưa đạt');
      var srcNote = r.commit!==null && r.commit!==undefined ? ' <span title="Có đặt Commit riêng — xem cột Commit/%HT Commit, chạy song song với KPI theo bậc" style="cursor:help">📌</span>' : '';
      var pctCColor = r.pctCommit===null ? 'var(--muted)' : (r.pctCommit>=100 ? '#16a34a' : '#dc2626');
      html += '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.nhom)+'</td><td>'+tierLabel+srcNote+'</td>'+
        '<td style="text-align:right">'+_srMoney(r.revenue)+'</td>'+
        '<td style="text-align:right">'+(r.target?_srMoney(r.target):'<span style="color:var(--hint)">—</span>')+'</td>'+
        '<td style="text-align:right;font-weight:700;color:'+pctColor+'">'+(r.pct===null?'—':r.pct+'%')+'</td>'+
        '<td style="text-align:right">'+(r.commit?_srMoney(r.commit):'<span style="color:var(--hint)">—</span>')+'</td>'+
        '<td style="text-align:right;font-weight:700;color:'+pctCColor+'">'+(r.pctCommit===null?'—':r.pctCommit+'%')+'</td>'+
        '<td style="font-weight:600;color:'+pctColor+'">'+resultTxt+'</td></tr>';
    });
    if (!rows.length) html += '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    else if (!_fSelfView) html += _srTotalRowHtml_(['Tổng','','', _srMoney(fTotalRevenue), _srMoney(fTotalTarget), '', _srMoney(fTotalCommit), '', '']);
    html += '</tbody></table></div>';
  } else {
    html += '<div style="font-size:11px;color:var(--hint);margin-bottom:4px">Vẽ theo "Doanh thu"</div>';
    html += _srChartSvg(rows, 'name', 'revenue', _srState.fKpiView, true);
  }

  // ── Lich su Bac theo thang (THEM 2026-10-04, yeu cau Duyen) — backend da tinh san timeline
  // cho moi Sale (xem _computeSaleTierTimeline_/buildSaleKpiReport_ o gas_v13.js), o day chi ve
  // thanh bang ngang: 1 cot/thang (d.trackedMonths, tu trackingStartMonth den thang hien tai),
  // giong dung cach xem T9->T10->T11->... trong file Excel "Theo doi doanh thu". O doi bac so
  // voi thang ngay truoc duoc to vang de de ra soat, giong Excel. Dung "rows" (da loc self-view
  // o tren), KHONG dung d.rows truc tiep — tranh 1 Sale thuong tu xem minh lai thay lich su bac
  // cua nguoi khac.
  var months = d.trackedMonths || [];
  var rowsWithTimeline = rows.filter(function(r){ return r.timeline; });
  if (months.length && rowsWithTimeline.length){
    function monthLabel(ym){ var p = String(ym).split('-'); return p[1]+'/'+p[0]; }
    html += '<div class="dash-section-title" style="margin-top:16px">📅 Lịch sử Bậc theo tháng'+
      '<span style="font-size:11px;color:var(--hint);font-weight:400"> — ô tô vàng = tháng có đổi bậc so với tháng trước</span></div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Sale</th>'+
      months.map(function(ym){ return '<th style="text-align:center">'+esc(monthLabel(ym))+'</th>'; }).join('')+
      '</tr></thead><tbody>';
    rowsWithTimeline.forEach(function(r){
      html += '<tr><td>'+esc(r.name)+'</td>';
      months.forEach(function(ym, i){
        var tier = r.timeline[ym] || '';
        var changed = i > 0 && tier && tier !== (r.timeline[months[i-1]] || '');
        html += '<td style="text-align:center'+(changed ? ';background:#fef9c3;font-weight:700' : '')+'">'+(tier ? esc(tier) : '<span style="color:var(--hint)">—</span>')+'</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  return html;
}

// ── BÁO CÁO G: ĐƠN BỊ LOẠI (Hủy/Trả lại/Hoàn tiền/Thất bại/Khiếu nại) ──
// Nguồn POS ("dữ liệu đơn", cùng nguồn Báo cáo B/E/F) và cùng định nghĩa trạng thái bị loại
// (Pos chỉ loại "Đã hoàn" và "Đang hoàn" — _donHasExcludedStatus_ ở backend) như Báo cáo B, nhưng CHỈ lấy đúng các đơn đã bị loại đó để xem
// riêng: bao nhiêu đơn, thuộc sale nào, MKT nào, lý do gì. COD/Giá trị CHỈ để tham khảo — KHÔNG tính vào doanh số.
// ════════════════════════════════════════════════════════════════════
//  BÁO CÁO G: CHƯƠNG TRÌNH THƯỞNG — THỬ VIỆC & CHÍNH THỨC (thay cho "Đơn bị loại", yêu cầu Duyên 2026-10-04).
//  Dùng ĐÚNG engine thưởng của Báo cáo E (_computeBonusData_ + BONUS_PROGRAMS, cùng nguồn đơn Pos
//  action=salesReportB, cùng bản đồ Online/Offline/Thử việc SALE_CHANNELS) — chỉ khác là tách riêng 2 nhóm:
//   • Thử việc  = Sale được phân loại "Thử việc" (SALE_CHANNELS[name]==='probation'), kèm Ngày bắt đầu + ngày thứ mấy.
//   • Chính thức = mọi Sale còn lại (Online / Offline / chưa phân loại).
//  Có xuất CSV (chi tiết từng lượt thưởng / tổng hợp / đơn đã dùng để tính) để kế toán đối chiếu.
//  Backend action failedOrderReport giữ nguyên (không còn tab nào gọi), chỉ bỏ giao diện.
// ════════════════════════════════════════════════════════════════════
function _srGSaleTypeLabel_(name){
  var c = SALE_CHANNELS[name];
  return c === 'probation' ? 'Thử việc' : (c === 'online' ? 'Online' : (c === 'offline' ? 'Offline' : 'Chưa phân loại'));
}
function _srGDecode_(s){
  return String(s == null ? '' : s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,'&');
}
// Tách kết quả _computeBonusData_ thành 2 nhóm + tổng hợp theo chương trình.
function _srGBuildGroups_(orders){
  var bonus = _computeBonusData_(orders || []);
  var g = { tv: { rows: [], total: 0 }, ct: { rows: [], total: 0 }, total: bonus.total, programs: {} };
  bonus.bySale.forEach(function(r){
    var isTv = SALE_CHANNELS[r.name] === 'probation';
    var grp = isTv ? g.tv : g.ct;
    grp.rows.push(r); grp.total += r.total;
    r.items.forEach(function(it){
      var p = g.programs[it.program] || (g.programs[it.program] = { name: it.program, tvCount: 0, tvAmount: 0, ctCount: 0, ctAmount: 0 });
      if (isTv){ p.tvCount++; p.tvAmount += it.amount; } else { p.ctCount++; p.ctAmount += it.amount; }
    });
  });
  return g;
}
function _srRenderG_(d){
  if (!d) return _srNoDataHtml_();
  if (d.error) return '<div style="color:#dc2626;text-align:center;padding:30px">Lỗi: '+esc(d.error)+'</div>';
  if (!BONUS_PROGRAMS.length){
    return '<div style="color:var(--muted);font-size:12px;padding:14px 0">Chưa có chương trình thưởng nào'+(_srIsAdmin() ? ' — bấm "⚙ Cài đặt → 🏆 Chương trình thưởng" ở trên để thêm.' : '.')+'</div>';
  }
  var g = _srGBuildGroups_(d.orders || []);
  var html = '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">Thưởng tính theo đúng các chương trình đã cài ở "🏆 Chương trình thưởng" (cùng cách tính với mục c) của Báo cáo E), '+
    'trên đơn Pos trong khoảng ngày lọc. <b>Thử việc</b> = Sale phân loại "Thử việc"; <b>Chính thức</b> = Sale Online/Offline/chưa phân loại. '+
    'Nhóm cơ chế "theo ngày" chỉ lấy mức cao nhất; các nhóm khác nhau cộng dồn.</div>';

  html += '<div class="kpi-grid" style="margin-bottom:16px">'+
    '<div class="kpi-card" style="border:1.5px solid var(--text)"><div class="kpi-val">'+_srMoney(g.total)+'</div><div class="kpi-label"><b>Tổng thưởng</b></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(g.tv.total)+'</div><div class="kpi-label">Thưởng Thử việc ('+fmt(g.tv.rows.length)+' Sale)</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(g.ct.total)+'</div><div class="kpi-label">Thưởng Chính thức ('+fmt(g.ct.rows.length)+' Sale)</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt((d.orders||[]).length)+'</div><div class="kpi-label">Đơn Pos dùng để tính</div></div>'+
    '</div>';

  function groupTable(title, key, grp, isTv){
    var h = '<div class="dash-section-title" style="margin-top:16px">'+title+'</div>';
    h += '<table class="dash-table"><thead><tr><th>Sale</th>'+(isTv ? '<th>Ngày bắt đầu</th>' : '<th>Loại</th>')+
      '<th style="text-align:right">Số lượt thưởng</th><th style="text-align:right"><b>Tổng thưởng</b></th><th></th></tr></thead><tbody>';
    grp.rows.forEach(function(s, i){
      var rid = key+'_'+i;
      var expanded = _srState.gBonusExpanded === rid;
      var sd = isTv ? _saleStartDate_(s.name) : '';
      h += '<tr><td>'+esc(s.name)+'</td>'+
        '<td>'+(isTv ? (sd ? esc(sd) : '<span style="color:#9a3412">chưa đặt Ngày bắt đầu</span>') : esc(_srGSaleTypeLabel_(s.name)))+'</td>'+
        '<td style="text-align:right">'+fmt(s.items.length)+'</td>'+
        '<td style="text-align:right"><b>'+_srMoney(s.total)+'</b></td>'+
        '<td><button class="btn sm" onclick="_srState.gBonusExpanded='+(expanded ? "''" : "'"+rid+"'")+';renderSalesReportTab()">'+(expanded ? 'Ẩn' : 'Chi tiết')+'</button></td></tr>';
      if (expanded){
        h += '<tr><td colspan="5" style="background:var(--surface2);padding:8px 14px"><table class="dash-table" style="margin:0"><thead><tr><th>Ngày</th>'+(isTv ? '<th>Ngày thứ</th>' : '')+'<th>Phạm vi</th><th>Chương trình</th><th>Chi tiết</th><th style="text-align:right">Thưởng</th></tr></thead><tbody>'+
          s.items.map(function(it){
            var dn = (isTv && sd) ? _daysSinceStart_(sd, it.date) : null;
            return '<tr><td>'+esc(it.date)+'</td>'+(isTv ? '<td>'+(dn === null ? '—' : dn)+'</td>' : '')+'<td>'+esc(it.scope)+'</td><td>'+esc(it.program)+'</td><td style="font-size:11px;color:var(--muted)">'+it.detail+'</td><td style="text-align:right">'+_srMoney(it.amount)+'</td></tr>';
          }).join('')+'</tbody></table></td></tr>';
      }
    });
    if (!grp.rows.length) h += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Không có thưởng nào phát sinh trong khoảng lọc</td></tr>';
    else h += _srTotalRowHtml_(['Tổng', '', fmt(grp.rows.reduce(function(s,r){return s+r.items.length;},0)), '<b>'+_srMoney(grp.total)+'</b>', '']);
    h += '</tbody></table>';
    return h;
  }
  html += groupTable('🌱 Sale Thử việc', 'tv', g.tv, true);
  html += groupTable('🏅 Sale Chính thức', 'ct', g.ct, false);

  var progs = Object.keys(g.programs).map(function(k){ return g.programs[k]; }).sort(function(a,b){ return (b.tvAmount+b.ctAmount)-(a.tvAmount+a.ctAmount); });
  html += '<div class="dash-section-title" style="margin-top:16px">Theo chương trình thưởng</div>';
  html += '<table class="dash-table"><thead><tr><th>Chương trình</th><th style="text-align:right">Lượt (Thử việc)</th><th style="text-align:right">Thưởng (Thử việc)</th><th style="text-align:right">Lượt (Chính thức)</th><th style="text-align:right">Thưởng (Chính thức)</th><th style="text-align:right"><b>Tổng</b></th></tr></thead><tbody>';
  progs.forEach(function(p){
    html += '<tr><td>'+esc(p.name)+'</td><td style="text-align:right">'+fmt(p.tvCount)+'</td><td style="text-align:right">'+_srMoney(p.tvAmount)+'</td><td style="text-align:right">'+fmt(p.ctCount)+'</td><td style="text-align:right">'+_srMoney(p.ctAmount)+'</td><td style="text-align:right"><b>'+_srMoney(p.tvAmount+p.ctAmount)+'</b></td></tr>';
  });
  if (!progs.length) html += '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:14px">Chưa có chương trình nào phát sinh thưởng</td></tr>';
  else html += _srTotalRowHtml_(['Tổng', fmt(progs.reduce(function(s,p){return s+p.tvCount;},0)), _srMoney(g.tv.total), fmt(progs.reduce(function(s,p){return s+p.ctCount;},0)), _srMoney(g.ct.total), '<b>'+_srMoney(g.total)+'</b>']);
  html += '</tbody></table>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:6px">"SL ước tính" ở chương trình theo sản phẩm là ước lượng từ ô mô tả sản phẩm — nên đối chiếu lại bằng file CSV trước khi chi nếu số tiền lớn. Sale chưa phân loại Online/Offline/Thử việc chỉ nhận được các chương trình không giới hạn đối tượng. Sale Thử việc chưa đặt "Ngày bắt đầu" (👤 Quản lý tài khoản) sẽ không nhận các chương trình theo ngày thử việc.</div>';
  return html;
}

// ── Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt) ──
function _srGCsvCell_(v){ return '"'+String(v == null ? '' : v).replace(/"/g,'""')+'"'; }
function _srGDownloadCsv_(filename, rows){
  var csv = '\uFEFF' + rows.map(function(r){ return r.map(_srGCsvCell_).join(','); }).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
// Dựng dữ liệu xuất dùng chung cho CSV và Excel (1 nguồn → 2 định dạng không thể lệch nhau).
function _srGBuildExport_(d){
  var ordersHead = ['Ngày tạo','Mã đơn Pos (ghi chú đơn)','Kênh bán (Nguồn đơn)','Sale (đã lọc hợp lệ)','Sản phẩm','Giá trị sau giảm','COD','Marketer','Trạng thái'];
  var orders = [ordersHead];
  d.orders.forEach(function(o){ orders.push([o.ngayTao, o.ghiChu || '', o.nguonDon, o.saleBan, o.sanPham, o.giaTriDon, o.cod, o.marketer, o.trangThai]); });
  var g = _srGBuildGroups_(d.orders);
  var detail = [['Nhóm','Sale','Loại Sale','Ngày bắt đầu (Thử việc)','Ngày thưởng','Ngày thứ (Thử việc)','Phạm vi','Chương trình','Chi tiết','Mã đơn Pos (ghi chú đơn)','Tiền thưởng']];
  [['Thử việc', g.tv], ['Chính thức', g.ct]].forEach(function(pair){
    pair[1].rows.forEach(function(s){
      var sd = pair[0] === 'Thử việc' ? _saleStartDate_(s.name) : '';
      s.items.forEach(function(it){
        var dn = sd ? _daysSinceStart_(sd, it.date) : '';
        detail.push([pair[0], s.name, _srGSaleTypeLabel_(s.name), sd, it.date, dn === null ? '' : dn, it.scope, it.program, _srGDecode_(it.detail), it.maDonPos || it.orderId || '', it.amount]);
      });
    });
  });
  var summary = [['Nhóm','Sale','Loại Sale','Ngày bắt đầu (Thử việc)','Số lượt thưởng','Tổng thưởng']];
  [['Thử việc', g.tv], ['Chính thức', g.ct]].forEach(function(pair){
    pair[1].rows.forEach(function(s){ summary.push([pair[0], s.name, _srGSaleTypeLabel_(s.name), pair[0] === 'Thử việc' ? _saleStartDate_(s.name) : '', s.items.length, s.total]); });
    summary.push([pair[0]+' — TỔNG','','','', pair[1].rows.reduce(function(a,r){return a+r.items.length;},0), pair[1].total]);
  });
  summary.push(['TỔNG CHUNG','','','','', g.total]);
  var programs = [['Chương trình','Lượt (Thử việc)','Thưởng (Thử việc)','Lượt (Chính thức)','Thưởng (Chính thức)','Tổng']];
  Object.keys(g.programs).forEach(function(k){ var p = g.programs[k]; programs.push([p.name, p.tvCount, p.tvAmount, p.ctCount, p.ctAmount, p.tvAmount+p.ctAmount]); });
  return { orders: orders, detail: detail, summary: summary, programs: programs, groups: g };
}
function _srGExportCsv_(kind){
  var d = _srState.dataG;
  if (!d || !d.orders){ toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  var tag = (_srState.gDateFrom || 'tu-dau') + '_' + (_srState.gDateTo || 'den-nay');
  var x = _srGBuildExport_(d);
  if (kind === 'orders'){ _srGDownloadCsv_('don-pos-tinh-thuong_'+tag+'.csv', x.orders); return; }
  if (kind === 'detail'){ _srGDownloadCsv_('thuong-chi-tiet_'+tag+'.csv', x.detail); return; }
  var sum = x.summary.slice(); sum.push([]);
  x.programs.forEach(function(r){ sum.push(r); });
  _srGDownloadCsv_('thuong-tong-hop_'+tag+'.csv', sum);
}
// Xuất Excel (.xlsx) 1 file 3 sheet để gửi kế toán đối chiếu với Pos: Tổng hợp / Chi tiết lượt thưởng (có Mã đơn) / Đơn Pos dùng để tính.
// Số tiền là SỐ THẬT (định dạng #,##0) để kế toán cộng/lọc/đối chiếu được ngay, không phải chuỗi.
function _srGNum_(v){
  if (typeof v === 'number') return v;
  var t = String(v == null ? '' : v).trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : v;
}
function _srGSheet_(rows){
  rows = rows.map(function(r){ return r.map(_srGNum_); });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var widths = [];
  rows.forEach(function(r){ r.forEach(function(c, i){ var l = String(c == null ? '' : c).length; if (!widths[i] || l > widths[i]) widths[i] = l; }); });
  ws['!cols'] = widths.map(function(w){ return { wch: Math.max(8, Math.min(50, w + 2)) }; });
  Object.keys(ws).forEach(function(k){ if (k[0] !== '!' && ws[k].t === 'n') ws[k].z = '#,##0'; });
  return ws;
}
function _srGExportXlsx_(){
  var d = _srState.dataG;
  if (!d || !d.orders){ toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  if (typeof XLSX === 'undefined'){ toast('Chưa tải được thư viện Excel — kiểm tra mạng rồi thử lại.'); return; }
  var x = _srGBuildExport_(d), g = x.groups;
  var from = _srState.gDateFrom || '', to = _srState.gDateTo || '';
  var sel = (_srState.gSale || []);
  var head = [
    ['BÁO CÁO THƯỞNG SALE — ĐỐI CHIẾU THEO POS'],
    ['Kỳ báo cáo', (from || 'từ đầu') + ' → ' + (to || 'đến nay')],
    ['Sale', sel.length ? sel.join(', ') : 'Tất cả'],
    ['Ngày xuất', _ymd(new Date())],
    ['Người xuất', (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''],
    ['Số đơn Pos dùng để tính', d.orders.length],
    ['Tổng thưởng', g.total],
    []
  ];
  var sumRows = head.concat(x.summary, [[]], x.programs);
  // Dòng tổng cho sheet đơn Pos (để kế toán đối chiếu nhanh với tổng trên Pos)
  var ord = x.orders.slice(), n = d.orders.length;
  var sumCol = function(k){ return d.orders.reduce(function(a,o){ var v = _srGNum_(o[k]); return a + (typeof v === 'number' ? v : 0); }, 0); };
  ord.push(['TỔNG ('+n+' đơn)','','','','', sumCol('giaTriDon'), sumCol('cod'),'','']);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, _srGSheet_(sumRows), 'Tổng hợp');
  XLSX.utils.book_append_sheet(wb, _srGSheet_(x.detail), 'Chi tiết lượt thưởng');
  XLSX.utils.book_append_sheet(wb, _srGSheet_(ord), 'Đơn Pos đối chiếu');
  XLSX.writeFile(wb, 'BaoCao_Thuong_' + (from || 'tu-dau') + '_' + (to || 'den-nay') + '.xlsx');
  toast('📗 Đã xuất Excel 3 sheet — gửi kế toán đối chiếu');
}

function _srGFiltersHtml_(){
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filters += _quickRangeSelectHtml(_srState.gDateQuick, "_srApplyQuickRange('gDateQuick','gDateFrom','gDateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.gDateFrom)+'" onchange="_srSetField(\'gDateFrom\',this.value);_srState.gDateQuick=\'custom\'" title="Từ ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.gDateTo)+'" onchange="_srSetField(\'gDateTo\',this.value);_srState.gDateQuick=\'custom\'" title="Đến ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  if (_srIsAdmin()){
    filters += _srComboHtml('sr-sale-combo-g', 'gSale', 'saleBOptions', 'Lọc theo Sale', '🔍 Tìm & chọn sale...', 190);
  } else if (currentUser.role === 'leader' && (_srState.leaderTeamOptions||[]).length){
    filters += _srComboHtml('sr-sale-combo-g', 'gSale', 'leaderTeamOptions', 'Lọc theo tên (team của bạn)', '🔍 Tìm tên trong team...', 190);
    filters += '<button class="btn sm" title="Xem lại cả team (bỏ hết lựa chọn riêng)" onclick="_srState.gSale=_srState.leaderTeamOptions.slice();_srState.gSaleCustomized=false;_srApply()">🔄 Cả team</button>';
  } else {
    filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
      '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.gSale||[]).join(', ') || currentUser.name)+' — chỉ xem được thưởng của mình</div></div>';
  }
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  filters += '<div class="gear-menu"><button class="btn sm" onclick="_srToggleGearMenu(event,\'sr-gear-g-export\')">⬇️ Xuất Excel / CSV</button>'+
    '<div class="gear-menu-list" id="sr-gear-g-export" onclick="event.stopPropagation()">'+
      '<div onclick="closeGearMenus();_srGExportXlsx_()"><b>📗 Excel đầy đủ (gửi kế toán) — 3 sheet</b></div>'+
      '<div onclick="closeGearMenus();_srGExportCsv_(\'summary\')">📊 Tổng hợp (theo Sale + theo chương trình)</div>'+
      '<div onclick="closeGearMenus();_srGExportCsv_(\'detail\')">🧾 Chi tiết từng lượt thưởng</div>'+
      '<div onclick="closeGearMenus();_srGExportCsv_(\'orders\')">📦 Đơn Pos dùng để tính (đối chiếu)</div>'+
    '</div></div>';
  if (_srIsAdmin()) filters += '<div class="gear-menu">'+
      '<button class="btn sm" onclick="_srToggleGearMenu(event,\'sr-gear-g\')">⚙ Cài đặt</button>'+
      '<div class="gear-menu-list" id="sr-gear-g" onclick="event.stopPropagation()">'+
        '<div onclick="closeGearMenus();openBonusProgramsModal()">🏆 Chương trình thưởng</div>'+
        '<div onclick="closeGearMenus();openSaleChannelsModal()">🏷️ Phân loại Online/Offline/Thử việc</div>'+
      '</div></div>';
  filters += '</div>';

  return filters;
}
function renderSalesReportTabG_(wrap, subTabs){
  var filters = _srGFiltersHtml_();
  var body = _srState.loading
    ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>'
    : _srRenderG_(_srState.dataG);

  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + filters + body;
}

function openSaleKpiConfigModal_(){
  var d = _srState.dataF;
  if (!d || !d.rows){ toast('Chưa tải được danh sách Sale — bấm "Lọc" trước.'); return; }
  var cfg = d.config || {};
  // LUU Y: state duoi day giu DUNG DON VI TRIEU (khong phai VND tho) ngay tu day, vi cac o
  // nhap trong modal deu nhap theo trieu — neu giu VND tho o day thi truong nao NGUOI DUNG
  // KHONG dong den se bi nhan nham x1.000.000 mot lan nua khi luu (_srSaveKpiConfig_ luon nhan
  // moi truong len x1.000.000, gia dinh state dang o don vi trieu).
  var tierTargets = {};
  SALE_TIER_ORDER_CLIENT_.forEach(function(k){ tierTargets[k] = Math.round(((cfg.tierTargets && cfg.tierTargets[k]) || 0)/1000000); });
  _srState.fEditing = {
    tierTargets: tierTargets,
    trackingStartMonth: cfg.trackingStartMonth || '2026-09',
    rows: d.rows.map(function(r){ return { name:r.name, startTier: (cfg.startTier && cfg.startTier[r.name]) || '', override: (cfg.overrides && cfg.overrides[r.name]!==undefined) ? Math.round(cfg.overrides[r.name]/1000000) : '' }; })
  };
  _srRenderKpiConfigModal_();
}
function _srKpiEditSetTarget(tier, val){ _srState.fEditing.tierTargets[tier] = val; }
function _srKpiEditSetStartMonth(val){ _srState.fEditing.trackingStartMonth = val; }
function _srKpiEditSetStartTier(i, val){ _srState.fEditing.rows[i].startTier = val; }
function _srKpiEditSetOverride(i, val){ _srState.fEditing.rows[i].override = val; }
function _srKpiEditSearch(q){
  var body = document.getElementById('sr-kpi-modal-rows');
  if (body) body.innerHTML = _srKpiConfigRowsHtml_(q);
}
function _srKpiConfigRowsHtml_(q){
  var ed = _srState.fEditing;
  var qf = (q||'').toLowerCase();
  var idxs = []; ed.rows.forEach(function(r,i){ if (!qf || r.name.toLowerCase().indexOf(qf)!==-1) idxs.push(i); });
  if (!idxs.length) return '<div style="color:var(--muted);padding:10px 0">Không tìm thấy Sale nào khớp.</div>';
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'+
    '<th style="text-align:left;padding:3px 8px 3px 0">Sale</th><th style="text-align:left;width:34%">Bậc bắt đầu</th><th>Commit riêng</th></tr></thead><tbody>';
  idxs.forEach(function(i){
    var r = ed.rows[i];
    var tierCell = '<select onchange="_srKpiEditSetStartTier('+i+',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border);border-radius:5px;background:var(--surface)">'+
        '<option value=""'+(r.startTier===''?' selected':'')+'>— chưa gán —</option>'+
        SALE_TIER_ORDER_CLIENT_.map(function(t){ return '<option value="'+t+'"'+(r.startTier===t?' selected':'')+'>'+esc(SALE_TIER_LABEL_CLIENT_[t])+'</option>'; }).join('')+
      '</select>';
    html += '<tr><td style="padding:3px 8px 3px 0">'+esc(r.name)+'</td>'+
      '<td>'+tierCell+'</td>'+
      '<td><input type="number" min="0" step="1" placeholder="để trống = không đặt" value="'+esc(r.override)+'" oninput="_srKpiEditSetOverride('+i+',this.value)" style="width:100%;padding:3px 6px;border:1px solid var(--border);border-radius:5px;background:var(--surface)"> <span style="color:var(--hint);font-size:10.5px">triệu</span></td></tr>';
  });
  html += '</tbody></table>';
  return html;
}
function _srRenderKpiConfigModal_(){
  var ed = _srState.fEditing;
  var m = document.getElementById('sr-kpi-modal');
  if (m) m.remove();
  var el = document.createElement('div');
  el.id = 'sr-kpi-modal';
  el.className = 'modal-overlay open';
  var fTrack = ['TVF1','TVF2','F1','F2','F3'], oTrack = ['O1','O2','O3','O'];
  function targetInput(t){
    return '<div><label style="font-size:11px;color:var(--muted);display:block">'+t+'</label>'+
      '<input type="number" min="0" step="1" value="'+esc(ed.tierTargets[t])+'" oninput="_srKpiEditSetTarget(\''+t+'\',this.value)" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"> triệu</div>';
  }
  el.innerHTML = '<div class="modal-box" style="max-width:680px;max-height:85vh;overflow-y:auto">'+
    '<div class="modal-title">🎯 Cài đặt KPI theo Bậc</div>'+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">Mỗi Sale có 1 <b>Bậc bắt đầu</b> tính từ tháng bắt đầu theo dõi bên dưới; bậc các tháng sau <b>tự tính</b> theo quy tắc: 3 tháng liên tiếp TB ≥125% KPI bậc hiện tại (không tháng nào &lt;70%) → lên 1 bậc (tối đa bậc 3); 3 tháng liên tiếp TB &lt;80% KPI bậc hiện tại → xuống 1 bậc. Bậc <b>O</b> không bao giờ đổi. Bậc <b>Thử việc</b> (TVF1/TVF2) luôn đúng 1 tháng; tháng sau TVF1→F1, TVF2→F2. Riêng TVF2→F2: 2 tháng đầu làm F2 phải MỖI tháng đạt ≥100% KPI F2, không đạt (dù chỉ 1 tháng) thì xuống ngay F1 để xét lại từ đầu. <b>Commit riêng</b> (nếu đặt) chạy SONG SONG với KPI theo bậc — có cột %HT riêng, không thay thế bậc. Nhập số theo <b>triệu đồng</b> cho gọn.</div>'+
    '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--muted);display:block">Tháng bắt đầu theo dõi</label>'+
      '<input type="month" value="'+esc(ed.trackingStartMonth)+'" onchange="_srKpiEditSetStartMonth(this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></div>'+
    '<div style="margin-bottom:6px"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:3px">KPI theo Bậc — Văn phòng (F)</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+fTrack.map(targetInput).join('')+'</div></div>'+
    '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:3px">KPI theo Bậc — Online (O)</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+oTrack.map(targetInput).join('')+'</div></div>'+
    '<input type="text" placeholder="🔍 Tìm nhanh theo tên sale..." oninput="_srKpiEditSearch(this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:100%;margin-bottom:4px">'+
    '<div id="sr-kpi-modal-rows">'+_srKpiConfigRowsHtml_('')+'</div>'+
    '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary" onclick="_srSaveKpiConfig_()">💾 Lưu</button><button class="btn secondary" onclick="document.getElementById(\'sr-kpi-modal\').remove()">Hủy</button></div>'+
    '</div>';
  document.body.appendChild(el);
}
async function _srSaveKpiConfig_(){
  var ed = _srState.fEditing;
  var config = { tierTargets: {}, trackingStartMonth: ed.trackingStartMonth || '2026-09', startTier: {}, overrides: {} };
  SALE_TIER_ORDER_CLIENT_.forEach(function(k){ config.tierTargets[k] = (Number(ed.tierTargets[k])||0)*1000000; });
  ed.rows.forEach(function(r){
    if (r.startTier) config.startTier[r.name] = r.startTier;
    if (r.override !== '' && r.override !== null && r.override !== undefined && !isNaN(Number(r.override))) {
      config.overrides[r.name] = Number(r.override)*1000000;
    }
  });
  try {
    var res = await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'setSetting', key:'saleKpiConfig', value: JSON.stringify(config) }) });
    var d = await res.json().catch(function(){ return {}; });
    if (d && d.error){ toast('❌ '+d.error); return; }
    toast('✓ Đã lưu cấu hình KPI');
    var m = document.getElementById('sr-kpi-modal'); if (m) m.remove();
    _srState.fEditing = null;
    _srLoad();
  } catch(e){ toast('❌ Lỗi: '+e.message); }
}

// ── Modal: % hoa hồng CÁ NHÂN (ghi đè % của team cho từng người, để trống = dùng theo team) ──
// Menu "⚙ Cài đặt" gộp gọn các nút cài đặt phụ (Báo cáo E) — chỉ 1 menu mở tại 1 thời điểm.
function _srToggleGearMenu(e, id){
  if (e) e.stopPropagation();
  var el = document.getElementById(id);
  var willOpen = el && el.style.display !== 'block';
  closeGearMenus();
  if (willOpen && el) el.style.display = 'block';
}
function closeGearMenus(){
  document.querySelectorAll('.gear-menu-list').forEach(function(el){ el.style.display = 'none'; });
}
function openIndividualRatesModal(){
  if (currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài % hoa hồng cá nhân.'); return; }
  _renderIndividualRatesModal();
  var m = document.getElementById('ir-modal');
  if (m) m.style.display = 'flex';
}
function closeIndividualRatesModal(){
  var m = document.getElementById('ir-modal');
  if (m) m.style.display = 'none';
}
function _renderIndividualRatesModal(){
  var body = document.getElementById('ir-body');
  if (!body) return;
  var names = (typeof _allCSNames === 'function' ? _allCSNames() : []).slice().sort(function(a,b){ return a.localeCompare(b,'vi'); });
  var q = (_irSearch||'').toLowerCase();
  var filtered = names.filter(function(n){ return !q || n.toLowerCase().indexOf(q)!==-1; });
  var html = '<input type="text" id="ir-search" placeholder="🔍 Tìm nhanh theo tên..." value="'+esc(_irSearch||'')+'" oninput="_irSearch=this.value;_renderIndividualRatesModal()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:240px;margin-bottom:10px">';
  html += '<table class="dash-table"><thead><tr><th>Tên</th><th>Team</th><th style="width:130px">% ≥15tr (riêng)</th><th style="width:130px">% &lt;15tr (riêng)</th></tr></thead><tbody>';
  filtered.forEach(function(name){
    var teamInfo = _teamRateForName_(name);
    var indiv = INDIVIDUAL_RATES[name] || {};
    html += '<tr><td>'+esc(name)+'</td>'+
      '<td style="color:var(--muted);font-size:11.5px">'+(teamInfo.team ? esc(teamInfo.team.name)+' ('+(teamInfo.rate.above15||0)+'% / '+(teamInfo.rate.below15||0)+'%)' : '<span style="color:var(--red)">chưa có team</span>')+'</td>'+
      '<td><input type="number" step="0.1" min="0" max="100" placeholder="theo team" value="'+(indiv.above15!==undefined&&indiv.above15!==null&&indiv.above15!==''?indiv.above15:'')+'" style="width:90px" onchange="_setIndividualRate(\''+esc(name).replace(/'/g,"\\'")+'\',\'above15\',this.value)"></td>'+
      '<td><input type="number" step="0.1" min="0" max="100" placeholder="theo team" value="'+(indiv.below15!==undefined&&indiv.below15!==null&&indiv.below15!==''?indiv.below15:'')+'" style="width:90px" onchange="_setIndividualRate(\''+esc(name).replace(/'/g,"\\'")+'\',\'below15\',this.value)"></td>'+
      '</tr>';
  });
  if (!filtered.length) html += '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px">Không có tên nào khớp</td></tr>';
  html += '</tbody></table>';
  body.innerHTML = html;
}
function _setIndividualRate(name, field, val){
  val = (val===''||val===null||val===undefined) ? '' : Math.max(0, Math.min(100, parseFloat(val)||0));
  if (!INDIVIDUAL_RATES[name]) INDIVIDUAL_RATES[name] = {};
  INDIVIDUAL_RATES[name][field] = val;
  saveIndividualRates();
}

function _setIndividualRate(name, field, val){
  val = (val===''||val===null||val===undefined) ? '' : Math.max(0, Math.min(100, parseFloat(val)||0));
  if (!INDIVIDUAL_RATES[name]) INDIVIDUAL_RATES[name] = {};
  INDIVIDUAL_RATES[name][field] = val;
  saveIndividualRates();
}

// ── Modal: PHÂN LOẠI SALE ONLINE / OFFLINE (Quản lý Team → cài từng sale) ──
function openSaleChannelsModal(){
  if (currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài phân loại Online/Offline.'); return; }
  _renderSaleChannelsModal();
  var m = document.getElementById('sc-modal');
  if (m) m.style.display = 'flex';
}
function closeSaleChannelsModal(){
  var m = document.getElementById('sc-modal');
  if (m) m.style.display = 'none';
}
function _renderSaleChannelsModal(){
  var body = document.getElementById('sc-body');
  if (!body) return;
  var html = '';

  // ── Khoi quan ly danh sach doi (them/sua/xoa) ──
  html += '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden">'+
    '<div style="padding:8px 10px;background:var(--surface2);cursor:pointer;font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center" onclick="_scGroupsOpen=!_scGroupsOpen;'+(_scGroupsOpen?'':'_scGroupsDraft=null;')+'_renderSaleChannelsModal()">'+
      '<span>⚙ Quản lý danh sách đội ('+SALE_GROUPS.length+' đội)</span><span>'+(_scGroupsOpen?'▲':'▼')+'</span></div>';
  if (_scGroupsOpen){
    if (!_scGroupsDraft) _scGroupsDraft = SALE_GROUPS.map(function(g){ return {key:g.key, label:g.label}; });
    html += '<div style="padding:10px">';
    _scGroupsDraft.forEach(function(g, i){
      var isDefault = (g.key==='online' || g.key==='offline');
      html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'+
        '<input type="text" value="'+esc(g.label)+'" placeholder="Tên đội (vd: CSKH, Quầy...)" oninput="_scGroupsDraft['+i+'].label=this.value" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px">'+
        '<code style="font-size:10px;color:var(--muted);min-width:60px">'+esc(g.key)+'</code>'+
        (isDefault ? '<span style="font-size:10px;color:var(--muted)" title="2 đội mặc định, không xoá được">🔒</span>'
          : '<button class="btn xs danger" onclick="_scGroupsDraft.splice('+i+',1);_renderSaleChannelsModal()" title="Xoá đội">🗑</button>')+
        '</div>';
    });
    html += '<button class="btn sm secondary" onclick="_scGroupsDraft.push({key:\'g\'+Date.now(),label:\'\'});_renderSaleChannelsModal()">+ Thêm đội mới</button> '+
      '<button class="btn sm primary" onclick="_scSaveGroups()">💾 Lưu danh sách đội</button>'+
      '</div>';
  }
  html += '</div>';

  // ── Bang phan loai tung Sale, dropdown dong theo SALE_GROUPS ──
  var names = (typeof _allCSNames === 'function' ? _allCSNames() : []).slice().sort(function(a,b){ return a.localeCompare(b,'vi'); });
  var q = (_scSearch||'').toLowerCase();
  var filtered = names.filter(function(n){ return !q || n.toLowerCase().indexOf(q)!==-1; });
  html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên..." value="'+esc(_scSearch||'')+'" oninput="_scSearch=this.value;_renderSaleChannelsModal()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:240px;margin-bottom:10px">';
  html += '<table class="dash-table"><thead><tr><th>Tên</th><th style="width:220px">Đội</th></tr></thead><tbody>';
  filtered.forEach(function(name){
    var cur = SALE_CHANNELS[name] || '';
    html += '<tr><td>'+esc(name)+'</td><td>'+
      '<select onchange="_setSaleChannel(\''+esc(name).replace(/'/g,"\\'")+'\',this.value)" style="width:200px">'+
      '<option value=""'+(cur===''?' selected':'')+'>— Chưa phân loại —</option>'+
      SALE_GROUPS.map(function(g){ return '<option value="'+esc(g.key)+'"'+(cur===g.key?' selected':'')+'>'+esc(g.label)+'</option>'; }).join('')+
      '</select></td></tr>';
  });
  if (!filtered.length) html += '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:14px">Không có tên nào khớp</td></tr>';
  html += '</tbody></table>';
  body.innerHTML = html;
}
function _scSaveGroups(){
  var clean = _scGroupsDraft.filter(function(g){ return (g.label||'').trim(); }).map(function(g){ return {key:g.key, label:g.label.trim()}; });
  if (!clean.length){ toast('Cần ít nhất 1 đội'); return; }
  _scGroupsDraft = null; _scGroupsOpen = false;
  saveSaleGroups(clean);
  _renderSaleChannelsModal();
}
function _setSaleChannel(name, val){
  if (val) SALE_CHANNELS[name] = val; else delete SALE_CHANNELS[name];
  saveSaleChannels();
}

function openChannelRatesModal(){
  if (currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài % hoa hồng theo Kênh.'); return; }
  _crNewKey = '';
  _renderChannelRatesModal();
  var m = document.getElementById('cr-modal');
  if (m) m.style.display = 'flex';
}
function closeChannelRatesModal(){
  var m = document.getElementById('cr-modal');
  if (m) m.style.display = 'none';
}
function _renderChannelRatesModal(){
  var body = document.getElementById('cr-body');
  if (!body) return;
  var keys = Object.keys(CHANNEL_COMMISSION_RATES).sort(function(a,b){ return a.localeCompare(b,'vi'); });
  var nguonOptions = (_srState && _srState.nguonOptions) || [];
  var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Đơn có Nguồn đơn khớp đúng (không phân biệt hoa/thường) 1 trong các tên dưới đây sẽ tính hoa hồng theo % cố định này, bỏ qua ngưỡng 15tr và % cá nhân/team. Mặc định (khi chưa cài): nguồn chỉ ghi "Facebook" = 1%.</div>';
  html += '<table class="dash-table"><thead><tr><th>Nguồn đơn</th><th style="width:140px">% hoa hồng</th><th style="width:60px"></th></tr></thead><tbody>';
  keys.forEach(function(k){
    html += '<tr><td>'+esc(k)+'</td>'+
      '<td><input type="number" step="0.1" min="0" value="'+esc(String(CHANNEL_COMMISSION_RATES[k]))+'" style="width:90px" onchange="_setChannelRate(\''+esc(k).replace(/'/g,"\\'")+'\',this.value)"></td>'+
      '<td><button class="btn sm" style="color:var(--red)" onclick="_setChannelRate(\''+esc(k).replace(/'/g,"\\'")+'\',\'\')">✕</button></td></tr>';
  });
  if (!keys.length) html += '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:14px">Chưa cài kênh nào — mọi đơn vẫn tính theo % cá nhân/team như cũ</td></tr>';
  html += '</tbody></table>';
  html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center">'+
    '<input list="cr-known-nguon" id="cr-new-key" placeholder="Tên Nguồn đơn (vd: facebook)" value="'+esc(_crNewKey||'')+'" oninput="_crNewKey=this.value" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px">'+
    '<input type="number" step="0.1" min="0" id="cr-new-rate" placeholder="%" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px">'+
    '<button class="btn sm" onclick="_addChannelRate()">+ Thêm</button>'+
    '</div>';
  if (nguonOptions.length) {
    html += '<datalist id="cr-known-nguon">' + nguonOptions.map(function(n){ return '<option value="'+esc(n)+'">'; }).join('') + '</datalist>';
  }
  body.innerHTML = html;
}
function _setChannelRate(key, val){
  if (val === '' || val === null || val === undefined) delete CHANNEL_COMMISSION_RATES[key];
  else CHANNEL_COMMISSION_RATES[key] = Math.max(0, parseFloat(val)||0);
  saveChannelCommissionRates();
  _renderChannelRatesModal();
}
function _addChannelRate(){
  var keyEl = document.getElementById('cr-new-key'), rateEl = document.getElementById('cr-new-rate');
  var key = ((keyEl ? keyEl.value : _crNewKey) || '').trim().toLowerCase();
  var rate = rateEl ? parseFloat(rateEl.value) : NaN;
  if (!key){ toast('Nhập tên kênh (Nguồn đơn) trước đã.'); return; }
  if (isNaN(rate) || rate < 0){ toast('Nhập % hợp lệ (vd 1 hoặc 0.8).'); return; }
  CHANNEL_COMMISSION_RATES[key] = rate;
  _crNewKey = '';
  saveChannelCommissionRates();
  _renderChannelRatesModal();
}

function openBonusProgramsModal(){
  if (currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài chương trình thưởng.'); return; }
  _bpEditingId = null;
  _renderBonusProgramsModal();
  var m = document.getElementById('bp-modal');
  if (m) m.style.display = 'flex';
}
function closeBonusProgramsModal(){
  var m = document.getElementById('bp-modal');
  if (m) m.style.display = 'none';
}
function _bpNewProgram(){
  return { id: 'bp_'+Date.now(), name: '', dateFrom:'', dateTo:'',
    audience: {online:false, offline:false}, product:'', requireProduct:'', extraNote:'', exclusionNote:'',
    tier: {enabled:false, rows:[]}, revenue: {enabled:false, scope:'order', min:'', max:''},
    firstOrder: {enabled:false, amount:''}, probationDay: {enabled:false, from:'', to:''},
    sources: [], prodRules: {enabled:false, items:[]},
    bonusAmount:'' };
}
// Chuong trinh cu luu tu truoc khi co firstOrder/probationDay se thieu 2 field nay -> bo sung
// mac dinh de tranh loi truy cap p.firstOrder.enabled tren undefined.
// Từ khoá sản phẩm BẮT BUỘC của 1 chương trình. CT "Bill vòng mix charm …" lưu từ trước khi có field requireProduct
// (undefined) vẫn phải chỉ tính đơn có sản phẩm "vòng" (yêu cầu Duyên 07/10/2026) nên dự phòng theo tên CT.
function _bonusRequireKw_(p){
  if (p.requireProduct !== undefined && p.requireProduct !== null) return String(p.requireProduct).trim();
  return /vòng/i.test(String(p.name||'').normalize('NFC')) ? 'vòng' : '';
}
// true nếu CT không đòi từ khoá, hoặc ô Sản phẩm của đơn chứa ÍT NHẤT 1 từ khoá (không phân biệt hoa/thường).
function _bonusRequireProductOk_(p, sanPham){
  var kws = _bonusRequireKw_(p).split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length) return true;
  var text = String(sanPham||'').normalize('NFC').toLowerCase();
  return kws.some(function(k){ return text.indexOf(k.normalize('NFC')) !== -1; });
}
function _bpNormalize_(p){
  if (!p.firstOrder) p.firstOrder = {enabled:false, amount:''};
  if (!p.probationDay) p.probationDay = {enabled:false, from:'', to:''};
  if (!Array.isArray(p.sources)) p.sources = [];
  if (!p.prodRules) p.prodRules = {enabled:false, items:[]};
  if (!Array.isArray(p.prodRules.items)) p.prodRules.items = [];
  return p;
}
function _renderBonusProgramsModal(){
  var body = document.getElementById('bp-body');
  if (!body) return;
  if (_bpEditingId === null){
    // Danh sách
    var html = '<button class="btn sm" onclick="_bpEditingId=\'new\';_bpDraft=_bpNewProgram();_renderBonusProgramsModal()">+ Thêm chương trình</button> '+
      '<button class="btn sm secondary" onclick="_bpSeedProbationTemplate_()" title="Tạo sẵn 5 chương trình đúng văn bản \'Cơ chế thưởng kích hoạt Sale mới\' — bạn chỉ cần kiểm tra lại rồi Lưu">🎁 Tạo mẫu: Thưởng Sale thử việc</button> '+
      '<button class="btn sm secondary" onclick="_bpSeedOfficialOnlineTemplate_()" title="Tạo sẵn các chương trình đúng bảng \'Thưởng online\' (áp dụng cho MỌI Sale chính thức, không riêng Sale online — Google Sheet Duyên gửi 2026-10) — bạn chỉ cần kiểm tra lại rồi Lưu">🎁 Tạo mẫu: Thưởng Sale chính thức</button>';
    html += '<table class="dash-table" style="margin-top:10px"><thead><tr><th>Chương trình</th><th>Từ — đến</th><th>Đối tượng</th><th>Cơ chế</th><th></th></tr></thead><tbody>';
    BONUS_PROGRAMS.forEach(function(p){
      var aud = (p.audience && p.audience.online && p.audience.offline) ? 'Cả 2' : ((p.audience && p.audience.online) ? 'Online' : ((p.audience && p.audience.offline) ? 'Offline' : 'Tất cả'));
      var mech = [];
      if (p.product) mech.push('Sản phẩm ('+esc(p.product)+')');
      if (p.prodRules && p.prodRules.enabled && (p.prodRules.items||[]).length) mech.push('Thưởng theo sản phẩm ('+p.prodRules.items.length+' mã)');
      if (p.sources && p.sources.length) mech.push('Theo nguồn: '+esc(p.sources.join(', '))+' (Online + Offline)');
      if (p.revenue && p.revenue.enabled) mech.push('Doanh thu theo '+(p.revenue.scope==='day'?'ngày':'đơn'));
      if (p.tier && p.tier.enabled) mech.push('Bậc số đơn/ngày');
      if (p.firstOrder && p.firstOrder.enabled) mech.push('Đơn đầu tiên/ngày');
      if (p.probationDay && p.probationDay.enabled) mech.push('Ngày thử việc '+(p.probationDay.from||1)+'→'+(p.probationDay.to||'∞'));
      html += '<tr><td><b>'+esc(p.name||'(chưa đặt tên)')+'</b></td>'+
        '<td style="font-size:11.5px">'+esc(p.dateFrom||'…')+' → '+esc(p.dateTo||'không giới hạn')+'</td>'+
        '<td>'+aud+'</td>'+
        '<td style="font-size:11.5px">'+(mech.join(', ')||'<span style="color:var(--red)">chưa cài cơ chế</span>')+'</td>'+
        '<td style="white-space:nowrap">'+
          '<button class="btn sm" onclick="_bpEditingId=\''+p.id+'\';_bpDraft=_bpNormalize_(JSON.parse(JSON.stringify(BONUS_PROGRAMS.find(function(x){return x.id===\''+p.id+'\';}))));_renderBonusProgramsModal()">Sửa</button> '+
          '<button class="btn sm secondary" onclick="_bpDelete(\''+p.id+'\')">Xoá</button></td></tr>';
    });
    if (!BONUS_PROGRAMS.length) html += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Chưa có chương trình thưởng nào</td></tr>';
    html += '</tbody></table>';
    body.innerHTML = html;
  } else {
    body.innerHTML = _bpEditFormHtml_(_bpDraft);
  }
}
function _bpEditFormHtml_(p){
  var tierRowsHtml = (p.tier.rows||[]).map(function(t, i){
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">'+
      '<span style="font-size:11.5px;color:var(--muted)">Từ</span>'+
      '<input type="number" min="1" value="'+esc(t.count)+'" style="width:70px" onchange="_bpDraft.tier.rows['+i+'].count=this.value">'+
      '<span style="font-size:11.5px;color:var(--muted)">đơn/ngày →</span>'+
      '<input type="number" min="0" value="'+esc(t.bonus)+'" style="width:110px" onchange="_bpDraft.tier.rows['+i+'].bonus=this.value">'+
      '<span style="font-size:11.5px;color:var(--muted)">đ</span>'+
      '<button class="btn sm secondary" onclick="_bpDraft.tier.rows.splice('+i+',1);_renderBonusProgramsModal()">✕</button></div>';
  }).join('');
  return '<div style="font-size:11px;color:var(--hint);margin-bottom:10px">Điền các mục cần dùng, bỏ trống mục không áp dụng. Trong CÙNG 1 nhóm cơ chế theo ngày (VD nhiều bậc số đơn, hoặc nhiều mốc doanh số) chỉ tính đúng 1 mức cao nhất — nhưng nếu 1 Sale/ngày đạt nhiều NHÓM khác nhau (số đơn/ngày, doanh số/ngày, đơn đầu tiên/ngày) thì được CỘNG DỒN các nhóm với nhau.</div>'+
    '<div class="form-label">1. Tên chương trình (để dễ nhận diện)</div>'+
    '<input type="text" value="'+esc(p.name)+'" oninput="_bpDraft.name=this.value" style="width:100%;margin-bottom:10px" placeholder="VD: Thưởng đơn giá trị cao">'+

    '<div class="form-label">2. Áp dụng từ ngày → đến ngày (bỏ trống ngày đến = không giới hạn)</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:10px">'+
      '<input type="date" value="'+esc(p.dateFrom)+'" onchange="_bpDraft.dateFrom=this.value">'+
      '<span style="color:var(--muted)">→</span>'+
      '<input type="date" value="'+esc(p.dateTo)+'" onchange="_bpDraft.dateTo=this.value">'+
    '</div>'+

    '<div class="form-label">3. Đối tượng áp dụng (không tích ô nào = áp dụng cho mọi Sale)</div>'+
    '<div style="margin-bottom:10px"><label style="margin-right:16px"><input type="checkbox" '+(p.audience.online?'checked':'')+' onchange="_bpDraft.audience.online=this.checked"> Sale Online</label>'+
    '<label><input type="checkbox" '+(p.audience.offline?'checked':'')+' onchange="_bpDraft.audience.offline=this.checked"> Sale Offline</label></div>'+

    '<div class="form-label">4. Sản phẩm áp dụng (từ khoá, cách nhau dấu phẩy — bỏ trống = mọi sản phẩm; nếu điền, thưởng sẽ NHÂN theo số lượng sản phẩm khớp bán được)</div>'+
    '<input type="text" value="'+esc(p.product)+'" oninput="_bpDraft.product=this.value" style="width:100%;margin-bottom:10px" placeholder="VD: Tỳ hưu, Tourmaline">'+

    _bpProdSectionHtml_(p)+
    _bpSrcSectionHtml_(p)+

    '<div class="form-label">5. Điều kiện áp dụng thêm (ghi chú — chỉ hiển thị để kế toán đối chiếu, KHÔNG tự động chấm)</div>'+
    '<input type="text" value="'+esc(p.extraNote)+'" oninput="_bpDraft.extraNote=this.value" style="width:100%;margin-bottom:10px" placeholder="VD: chỉ áp dụng đơn có bill chuyển khoản">'+

    '<div class="form-label">6. Số lượng đơn/ngày theo bậc thang (tick nếu cần)</div>'+
    '<label style="font-size:12px"><input type="checkbox" '+(p.tier.enabled?'checked':'')+' onchange="_bpDraft.tier.enabled=this.checked;_renderBonusProgramsModal()"> Dùng thưởng theo số đơn chốt trong ngày</label>'+
    (p.tier.enabled ? ('<div style="margin:8px 0 4px">'+tierRowsHtml+
      '<button class="btn sm" onclick="_bpDraft.tier.rows.push({count:\'\',bonus:\'\'});_renderBonusProgramsModal()">+ Thêm bậc</button></div>') : '')+

    '<div class="form-label" style="margin-top:10px">7. Yêu cầu doanh thu (tick nếu cần)</div>'+
    '<label style="font-size:12px"><input type="checkbox" '+(p.revenue.enabled?'checked':'')+' onchange="_bpDraft.revenue.enabled=this.checked;_renderBonusProgramsModal()"> Dùng điều kiện doanh thu</label>'+
    (p.revenue.enabled ? ('<div style="margin:8px 0">'+
      '<label style="margin-right:16px;font-size:12px"><input type="radio" name="bp-rev-scope" '+(p.revenue.scope==='order'?'checked':'')+' onchange="_bpDraft.revenue.scope=\'order\'"> Theo 1 đơn</label>'+
      '<label style="font-size:12px"><input type="radio" name="bp-rev-scope" '+(p.revenue.scope==='day'?'checked':'')+' onchange="_bpDraft.revenue.scope=\'day\'"> Theo tổng doanh số/ngày của Sale</label>'+
      '<div style="margin-top:6px;display:flex;gap:8px;align-items:center">'+
        '<span style="font-size:11.5px;color:var(--muted)">Từ</span><input type="number" min="0" value="'+esc(p.revenue.min)+'" style="width:140px" onchange="_bpDraft.revenue.min=this.value" placeholder="vd 20000000">'+
        '<span style="font-size:11.5px;color:var(--muted)">đến (bỏ trống = trở lên)</span><input type="number" min="0" value="'+esc(p.revenue.max)+'" style="width:140px" onchange="_bpDraft.revenue.max=this.value">'+
      '</div>'+
      '<div style="margin-top:8px;font-size:11.5px;color:var(--muted)">Chỉ tính khi ô Sản phẩm của đơn có từ khoá (cách nhau dấu phẩy, bỏ trống = không lọc; chỉ áp dụng khi chọn \"Theo 1 đơn\"):</div>'+
      '<input type="text" value="'+esc(_bonusRequireKw_(p))+'" oninput="_bpDraft.requireProduct=this.value" style="width:100%" placeholder="VD: vòng">'+
      '</div>') : '')+

    '<div class="form-label" style="margin-top:10px">8. Điều kiện loại trừ (ghi chú — chỉ hiển thị, KHÔNG tự động chấm)</div>'+
    '<input type="text" value="'+esc(p.exclusionNote)+'" oninput="_bpDraft.exclusionNote=this.value" style="width:100%;margin-bottom:10px" placeholder="VD: không áp dụng cho chất liệu Ngọc Lam, Ngọc Bích">'+

    '<div class="form-label">9. Tiền thưởng <span style="font-weight:400;color:var(--muted);font-size:11px">(dùng cho mục 4/7 — mục 6 dùng mức riêng từng bậc ở trên)</span></div>'+
    '<input type="number" min="0" value="'+esc(p.bonusAmount)+'" oninput="_bpDraft.bonusAmount=this.value" style="width:180px;margin-bottom:14px" placeholder="vd 50000">'+

    '<div class="form-label">10. Thưởng đơn ĐẦU TIÊN trong ngày (tick nếu cần)</div>'+
    '<label style="font-size:12px"><input type="checkbox" '+(p.firstOrder.enabled?'checked':'')+' onchange="_bpDraft.firstOrder.enabled=this.checked;_renderBonusProgramsModal()"> Dùng thưởng cho đơn ĐẦU TIÊN mỗi ngày (theo giờ tạo đơn sớm nhất)</label>'+
    (p.firstOrder.enabled ? ('<div style="margin:8px 0 14px;display:flex;gap:8px;align-items:center">'+
      '<span style="font-size:11.5px;color:var(--muted)">Số tiền / đơn đầu tiên:</span>'+
      '<input type="number" min="0" value="'+esc(p.firstOrder.amount)+'" style="width:160px" onchange="_bpDraft.firstOrder.amount=this.value" placeholder="vd 50000">'+
      '</div>') : '<div style="margin-bottom:10px"></div>')+

    '<div class="form-label">11. Giới hạn theo ngày thử việc (tick nếu chỉ áp dụng 1 khoảng ngày kể từ "Ngày bắt đầu" riêng của từng Sale)</div>'+
    '<label style="font-size:12px"><input type="checkbox" '+(p.probationDay.enabled?'checked':'')+' onchange="_bpDraft.probationDay.enabled=this.checked;_renderBonusProgramsModal()"> Chỉ áp dụng trong khoảng ngày thử việc</label>'+
    (p.probationDay.enabled ? ('<div style="margin:8px 0 4px;display:flex;gap:8px;align-items:center">'+
      '<span style="font-size:11.5px;color:var(--muted)">Ngày thứ</span>'+
      '<input type="number" min="1" value="'+esc(p.probationDay.from)+'" style="width:70px" onchange="_bpDraft.probationDay.from=this.value" placeholder="1">'+
      '<span style="font-size:11.5px;color:var(--muted)">đến ngày thứ (bỏ trống = không giới hạn)</span>'+
      '<input type="number" min="1" value="'+esc(p.probationDay.to)+'" style="width:70px" onchange="_bpDraft.probationDay.to=this.value" placeholder="30">'+
      '</div><div style="font-size:10.5px;color:var(--hint);margin-bottom:14px">Tính từ "Ngày bắt đầu" đặt riêng cho từng Sale ở 👤 Quản lý tài khoản (mốc tính thưởng theo ngày thử việc) — Ngày bắt đầu = ngày thứ 1. Sale chưa được đặt Ngày bắt đầu sẽ KHÔNG được tính chương trình có bật mục này.</div>') : '<div style="margin-bottom:10px"></div>')+

    '<div style="display:flex;gap:8px">'+
      '<button class="btn" onclick="_bpSave()">💾 Lưu chương trình</button>'+
      '<button class="btn secondary" onclick="_bpEditingId=null;_renderBonusProgramsModal()">Huỷ</button>'+
    '</div>';
}
// ── Mục 4b: THƯỞNG THEO SẢN PHẨM (tìm tên/mã → tích → nhập tiền thưởng từng sản phẩm) ──
var _bpProducts = null, _bpProdLoading = false, _bpProdErr = '', _bpProdQuery = '', _bpSrcQuery = '';
// Lọc TÙY CHỌN theo Size / Chất liệu khi tìm sản phẩm (bỏ qua = không lọc). Tuỳ chọn lấy từ bảng giá (priceCatalogFlat); so khớp với TÊN sản phẩm trên đơn (không dấu).
var _bpFacets = null, _bpFacetLoading = false, _bpSizeSel = [], _bpMatSel = [];
async function _bpLoadFacets_(){
  if (_bpFacets || _bpFacetLoading || !gsUrl) return;
  _bpFacetLoading = true;
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?')>-1?'&':'?') + 'action=priceCatalogFlat', {redirect:'follow'});
    var j = await r.json(), sz = {}, mt = {};
    ((j && j.items) || []).forEach(function(it){
      if (it.s && it.s !== '(mặc định)') sz[it.s] = (sz[it.s]||0)+1;
      if (it.c) mt[it.c] = (mt[it.c]||0)+1;
    });
    var top = function(o){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a] || a.localeCompare(b); }).slice(0, 40); };
    _bpFacets = { sizes: top(sz), mats: top(mt) };
  } catch(e){ _bpFacets = { sizes: [], mats: [] }; }
  _bpFacetLoading = false;
  _bpProdRefresh_();
}
function _bpFacetToggle(kind, v, on){
  var arr = kind === 'size' ? _bpSizeSel : _bpMatSel, i = arr.indexOf(v);
  if (on && i === -1) arr.push(v); else if (!on && i !== -1) arr.splice(i, 1);
  _bpProdRefresh_();
}
function _bpFacetHtml_(){
  if (!_bpFacets) return '';
  if (!_bpFacets.sizes.length && !_bpFacets.mats.length) return '';
  var chips = function(kind, list, sel){
    return list.map(function(v){
      return '<label style="display:inline-flex;gap:4px;align-items:center;font-size:11.5px;margin:2px 8px 2px 0;cursor:pointer"><input type="checkbox" data-v="'+esc(v)+'" '+(sel.indexOf(v)!==-1?'checked':'')+' onchange="_bpFacetToggle(\''+kind+'\',this.dataset.v,this.checked)"> '+esc(v)+'</label>';
    }).join('');
  };
  var n = _bpSizeSel.length + _bpMatSel.length;
  return '<details style="margin-bottom:6px"'+(n?' open':'')+'><summary style="font-size:11.5px;cursor:pointer;color:var(--muted)">Lọc thêm theo Size / Chất liệu (không bắt buộc'+(n?' — đang lọc '+n+' mục':'')+')</summary>'+
    (_bpFacets.sizes.length ? '<div style="font-size:11px;font-weight:600;margin-top:4px">Size</div>'+chips('size', _bpFacets.sizes, _bpSizeSel) : '')+
    (_bpFacets.mats.length ? '<div style="font-size:11px;font-weight:600;margin-top:4px">Chất liệu</div>'+chips('mat', _bpFacets.mats, _bpMatSel) : '')+
    (n ? '<button class="btn sm" style="margin-top:4px" onclick="_bpSizeSel=[];_bpMatSel=[];_bpProdRefresh_()">✕ Bỏ lọc size/chất liệu</button>' : '')+'</details>';
}
// Danh sách sản phẩm đã lọc theo từ khoá + size + chất liệu (mỗi nhóm: chỉ cần khớp ÍT NHẤT 1 mục đã tích; nhóm không tích = bỏ qua).
function _bpFilteredProducts_(){
  var q = _bpNorm_(_bpProdQuery);
  var sz = _bpSizeSel.map(_bpNorm_), mt = _bpMatSel.map(_bpNorm_);
  return (_bpProducts||[]).filter(function(x){
    var nm = _bpNorm_(x.name);
    if (q && nm.indexOf(q) === -1 && _bpNorm_(x.code).indexOf(q) === -1) return false;
    if (sz.length && !sz.some(function(t){ return t && nm.indexOf(t) !== -1; })) return false;
    if (mt.length && !mt.some(function(t){ return t && nm.indexOf(t) !== -1; })) return false;
    return true;
  });
}
function _bpProdPickAll(){
  var list = _bpFilteredProducts_();
  if (!list.length) return;
  if (list.length > 50 && !confirm('Tích tất cả '+list.length+' sản phẩm đang hiển thị?')) return;
  var items = _bpDraft.prodRules.items = _bpDraft.prodRules.items || [];
  list.forEach(function(x){
    if (!items.some(function(it){ return String(it.code).toLowerCase() === String(x.code).toLowerCase(); })) items.push({code:x.code, name:x.name||'', amount:''});
  });
  _bpProdRefresh_();
}
function _bpNorm_(t){ return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim(); }
async function _bpLoadProducts_(force){
  if (_bpProdLoading) return;
  if (_bpProducts && !force) return;
  if (!gsUrl){ _bpProdErr = 'Chưa kết nối Google Apps Script.'; return; }
  _bpProdLoading = true; _bpProdErr = '';
  _bpProdRefresh_();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?')>-1?'&':'?') + 'action=donProducts', {redirect:'follow'});
    var j = await r.json();
    if (j && j.ok && Array.isArray(j.products)) _bpProducts = j.products;
    else _bpProdErr = (j && j.error) || 'GAS chưa có action donProducts — deploy lại bản GAS mới nhất.';
  } catch(e){ _bpProdErr = 'Không tải được danh sách sản phẩm (' + (e && e.message || e) + ').'; }
  _bpProdLoading = false;
  _bpProdRefresh_();
}
function _bpProdSectionHtml_(p){
  var on = !!(p.prodRules && p.prodRules.enabled);
  var h = '<div class="form-label">4b. Thưởng theo SẢN PHẨM <span style="font-weight:400;color:var(--muted);font-size:11px">(khớp theo MÃ sản phẩm × số lượng trên đơn — mỗi sản phẩm 1 mức thưởng riêng)</span></div>'+
    '<label style="font-size:12px"><input type="checkbox" '+(on?'checked':'')+' onchange="_bpDraft.prodRules.enabled=this.checked;_renderBonusProgramsModal();if(this.checked)_bpLoadProducts_()"> Dùng thưởng theo từng sản phẩm</label>';
  if (on){
    h += '<div style="margin:8px 0 12px">'+
      '<input type="text" id="bp-prod-q" value="'+esc(_bpProdQuery)+'" placeholder="🔍 Gõ tên hoặc mã sản phẩm để tìm..." oninput="_bpProdQuery=this.value;_bpProdRefresh_()" style="width:100%;margin-bottom:6px">'+
      '<div id="bp-prod-facets">'+_bpFacetHtml_()+'</div>'+
      '<div id="bp-prod-list" style="max-height:210px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:8px">'+_bpProdListHtml_()+'</div>'+
      '<div id="bp-prod-pickall" style="margin-bottom:8px">'+_bpPickAllHtml_()+'</div>'+
      '<div style="font-size:11.5px;font-weight:600;margin-bottom:4px">Sản phẩm được thưởng (điền tiền thưởng cho 1 sản phẩm):</div>'+
      '<div id="bp-prod-sel">'+_bpProdSelHtml_()+'</div></div>';
    if (!_bpProducts && !_bpProdLoading) setTimeout(_bpLoadProducts_, 0);
    if (!_bpFacets) setTimeout(_bpLoadFacets_, 0);
  }
  return h;
}
function _bpProdListHtml_(){
  if (_bpProdLoading) return '<div style="color:var(--muted);font-size:12px;padding:6px">Đang tải danh sách sản phẩm…</div>';
  if (_bpProdErr) return '<div style="color:#b91c1c;font-size:12px;padding:6px">⚠ '+esc(_bpProdErr)+' <button class="btn sm" onclick="_bpLoadProducts_(true)">Thử lại</button></div>';
  if (!_bpProducts) return '<div style="color:var(--muted);font-size:12px;padding:6px">Chưa tải danh sách.</div>';
  var picked = {};
  (_bpDraft.prodRules.items||[]).forEach(function(it){ picked[String(it.code).toLowerCase()] = true; });
  var list = _bpFilteredProducts_();
  var total = list.length; list = list.slice(0, 60);
  if (!list.length) return '<div style="color:var(--muted);font-size:12px;padding:6px">Không có sản phẩm khớp "'+esc(_bpProdQuery)+'".</div>';
  return list.map(function(x){
    return '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;padding:3px 2px;cursor:pointer"><input type="checkbox" data-code="'+esc(x.code)+'" '+(picked[String(x.code).toLowerCase()]?'checked':'')+' onchange="_bpProdToggle(this.dataset.code,this.checked)">'+
      '<span><b>'+esc(x.name||'(chưa rõ tên)')+'</b> <span style="color:var(--muted)">— mã '+esc(x.code)+' · đã bán '+esc(String(Math.round(x.qty*10)/10))+'</span></span></label>';
  }).join('') + (total > 60 ? '<div style="color:var(--hint);font-size:11px;padding:4px">Còn '+(total-60)+' sản phẩm khác — gõ thêm từ khoá để thu hẹp.</div>' : '');
}
function _bpProdSelHtml_(){
  var items = _bpDraft.prodRules.items || [];
  if (!items.length) return '<div style="color:var(--muted);font-size:12px">Chưa tích sản phẩm nào.</div>';
  return items.map(function(it, i){
    return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;font-size:12px">'+
      '<span style="flex:1"><b>'+esc(it.name||it.code)+'</b> <span style="color:var(--muted)">(mã '+esc(it.code)+')</span></span>'+
      '<input type="number" min="0" value="'+esc(it.amount)+'" placeholder="tiền thưởng/sản phẩm" style="width:150px" onchange="_bpDraft.prodRules.items['+i+'].amount=this.value"> <span style="color:var(--muted)">đ</span>'+
      '<button class="btn sm secondary" onclick="_bpProdToggle(\''+esc(String(it.code)).replace(/'/g,"\\'")+'\',false)">✕</button></div>';
  }).join('');
}
function _bpPickAllHtml_(){
  if (!_bpProducts) return '';
  var n = _bpFilteredProducts_().length;
  return n ? '<button class="btn sm secondary" onclick="_bpProdPickAll()">☑ Tích tất cả '+n+' sản phẩm đang hiển thị</button>' : '';
}
function _bpProdRefresh_(){
  var a = document.getElementById('bp-prod-list'), b = document.getElementById('bp-prod-sel'), c = document.getElementById('bp-prod-facets'), d = document.getElementById('bp-prod-pickall');
  if (a) a.innerHTML = _bpProdListHtml_();
  if (b) b.innerHTML = _bpProdSelHtml_();
  if (c) c.innerHTML = _bpFacetHtml_();
  if (d) d.innerHTML = _bpPickAllHtml_();
}
function _bpProdToggle(code, on){
  var items = _bpDraft.prodRules.items = _bpDraft.prodRules.items || [];
  var idx = items.findIndex(function(x){ return String(x.code).toLowerCase() === String(code).toLowerCase(); });
  if (on && idx === -1){
    var meta = (_bpProducts||[]).find(function(x){ return String(x.code).toLowerCase() === String(code).toLowerCase(); });
    items.push({code:code, name:(meta && meta.name) || '', amount:''});
  } else if (!on && idx !== -1) items.splice(idx, 1);
  _bpProdRefresh_();
}
// ── Mục 4c: THƯỞNG THEO NGUỒN đơn (chung Online + Offline) ──
function _bpSrcSectionHtml_(p){
  var h = '<div class="form-label">4c. Thưởng theo NGUỒN đơn <span style="font-weight:400;color:var(--muted);font-size:11px">(tích nguồn → chương trình CHỈ tính đơn thuộc các nguồn này, áp dụng CHUNG Online + Offline; cơ chế tính tạo ở các mục 6–10 như thường)</span></div>'+
    '<input type="text" id="bp-src-q" value="'+esc(_bpSrcQuery)+'" placeholder="🔍 Gõ để tìm nguồn..." oninput="_bpSrcQuery=this.value;_bpSrcRefresh_()" style="width:100%;margin-bottom:6px">'+
    '<div id="bp-src-list" style="max-height:150px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:6px">'+_bpSrcListHtml_()+'</div>'+
    '<div id="bp-src-sel" style="font-size:12px;margin-bottom:12px">'+_bpSrcSelHtml_()+'</div>';
  if (!(_srState && _srState.nguonOptions && _srState.nguonOptions.length) && typeof _srLoadOptions === 'function' && !_srState.optionsLoaded) setTimeout(function(){ _srLoadOptions().then(_bpSrcRefresh_).catch(function(){}); }, 0);
  return h;
}
function _bpSrcListHtml_(){
  var opts = (_srState && _srState.nguonOptions) || [], q = _bpNorm_(_bpSrcQuery);
  var picked = {}; (_bpDraft.sources||[]).forEach(function(x){ picked[_bonusNormSrc_(x)] = true; });
  var list = opts.filter(function(n){ return !q || _bpNorm_(n).indexOf(q) !== -1; });
  if (!opts.length) return '<div style="color:var(--muted);font-size:12px;padding:6px">Đang tải danh sách nguồn… (hoặc mở Báo cáo doanh số rồi mở lại).</div>';
  if (!list.length) return '<div style="color:var(--muted);font-size:12px;padding:6px">Không có nguồn khớp.</div>';
  return list.map(function(n){
    return '<label style="display:inline-flex;gap:5px;align-items:center;font-size:12px;margin:2px 10px 2px 0;cursor:pointer"><input type="checkbox" data-src="'+esc(n)+'" '+(picked[_bonusNormSrc_(n)]?'checked':'')+' onchange="_bpSrcToggle(this.dataset.src,this.checked)"> '+esc(n)+'</label>';
  }).join('');
}
function _bpSrcSelHtml_(){
  var s = _bpDraft.sources || [];
  return s.length ? ('Đã chọn '+s.length+' nguồn: <b>'+esc(s.join(', '))+'</b> — áp dụng chung Online + Offline.') : '<span style="color:var(--muted)">Chưa chọn nguồn = chương trình không giới hạn theo nguồn.</span>';
}
function _bpSrcRefresh_(){
  var a = document.getElementById('bp-src-list'), b = document.getElementById('bp-src-sel');
  if (a) a.innerHTML = _bpSrcListHtml_();
  if (b) b.innerHTML = _bpSrcSelHtml_();
}
function _bpSrcToggle(name, on){
  var s = _bpDraft.sources = _bpDraft.sources || [];
  var idx = s.findIndex(function(x){ return _bonusNormSrc_(x) === _bonusNormSrc_(name); });
  if (on && idx === -1) s.push(name); else if (!on && idx !== -1) s.splice(idx, 1);
  _bpSrcRefresh_();
}
function _bpSave(){
  if (!_bpDraft.name || !_bpDraft.name.trim()){ toast('Vui lòng đặt tên chương trình.'); return; }
  var idx = BONUS_PROGRAMS.findIndex(function(x){ return x.id === _bpDraft.id; });
  if (idx === -1) BONUS_PROGRAMS.push(_bpDraft); else BONUS_PROGRAMS[idx] = _bpDraft;
  _bpEditingId = null;
  saveBonusPrograms();
  _renderBonusProgramsModal();
}
function _bpDelete(id){
  if (!confirm('Xoá chương trình thưởng này?')) return;
  BONUS_PROGRAMS = BONUS_PROGRAMS.filter(function(x){ return x.id !== id; });
  saveBonusPrograms();
  _renderBonusProgramsModal();
}
// Tao san 5 chuong trinh dung theo van ban "CO CHE THUONG KICH HOAT SALE MOI — GIAI DOAN THU
// VIEC" (11/08/2026 - 31/12/2026): GD1 = ngay 1-3 (don dau tien/ngay, 50k); GD2 = tu ngay 4
// (bac so don/ngay: 2->30k, 3->50k, 5->100k) + (moc doanh so/ngay: 25tr->30k, 50tr->50k,
// 80tr->100k, 3 CT rieng vi 1 CT "revenue" chi giu duoc 1 muc — xem _computeBonusData_, cac CT
// cung nhom "doanh so/ngay" da tu dong chi lay muc CAO NHAT dat duoc). CHI ap dung cho Sale da
// duoc dat "Ngay bat dau" o Quan ly tai khoan (xem _bonusProgramApplies_).
function _bpSeedProbationTemplate_(){
  if (!confirm('Tạo mới 5 chương trình mẫu theo đúng văn bản "Cơ chế thưởng kích hoạt Sale mới" (11/08/2026 - 31/12/2026)? Bạn nên kiểm tra lại từng chương trình (đặc biệt khoảng ngày) trước khi dùng thật. Không ảnh hưởng các chương trình đã có sẵn.')) return;
  var common = { dateFrom: '2026-08-11', dateTo: '2026-12-31', audience: {online:false, offline:false}, product:'', extraNote:'', exclusionNote:'' };
  var mk = function(o){ var p = _bpNewProgram(); return Object.assign(p, common, o, {id: 'bp_'+Date.now()+'_'+Math.floor(Math.random()*1000)}); };
  var seeded = [
    mk({ name: 'GĐ1 — Đơn đầu tiên trong ngày (ngày 1-3 thử việc)',
      probationDay: {enabled:true, from:1, to:3},
      firstOrder: {enabled:true, amount:50000} }),
    mk({ name: 'GĐ2 — Bậc số đơn/ngày (từ ngày 4 thử việc)',
      probationDay: {enabled:true, from:4, to:''},
      tier: {enabled:true, rows: [{count:2,bonus:30000},{count:3,bonus:50000},{count:5,bonus:100000}]} }),
    mk({ name: 'GĐ2 — Doanh số ≥25 triệu/ngày (từ ngày 4 thử việc)',
      probationDay: {enabled:true, from:4, to:''},
      revenue: {enabled:true, scope:'day', min:25000000, max:''}, bonusAmount: 30000 }),
    mk({ name: 'GĐ2 — Doanh số ≥50 triệu/ngày (từ ngày 4 thử việc)',
      probationDay: {enabled:true, from:4, to:''},
      revenue: {enabled:true, scope:'day', min:50000000, max:''}, bonusAmount: 50000 }),
    mk({ name: 'GĐ2 — Doanh số ≥80 triệu/ngày (từ ngày 4 thử việc)',
      probationDay: {enabled:true, from:4, to:''},
      revenue: {enabled:true, scope:'day', min:80000000, max:''}, bonusAmount: 100000 })
  ];
  BONUS_PROGRAMS = BONUS_PROGRAMS.concat(seeded);
  saveBonusPrograms();
  _renderBonusProgramsModal();
  toast('✓ Đã tạo 5 chương trình mẫu — nhớ đặt "Ngày bắt đầu" cho từng Sale thử việc ở Quản lý tài khoản.');
}


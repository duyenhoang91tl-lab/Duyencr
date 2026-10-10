// Canh bao khi backend phai bo qua N dong don hang bi loi khi doc (xem readAllOrders_ trong
// gas_v13.js) — danh sach KH luc nay CO THE THIEU vi chi duoc dung tren cac dong doc thanh cong.
// errSample la text loi cua dong dau tien bi bo qua, giup tra ngay nguyen nhan ma khong can mo
// Apps Script > Executions.
function showRowErrorBanner(errCount, errSample) {
  const existing = document.getElementById('row-err-banner');
  if (existing) { existing.remove(); } // luon thay bang thong tin moi nhat (so dong loi co the doi)
  const bar = document.getElementById('data-view');
  if (!bar) return;
  const banner = document.createElement('div');
  banner.id = 'row-err-banner';
  banner.style.cssText = 'background:#fef2f2;border-bottom:1px solid #fca5a5;padding:7px 14px;font-size:12px;color:#991b1b;display:flex;align-items:center;gap:10px;flex-shrink:0;';
  banner.innerHTML = `
    <span>⚠ <strong>${errCount} dòng đơn hàng bị lỗi khi đọc</strong> và đã bị bỏ qua — danh sách khách hàng/đơn hiện tại có thể THIẾU.${errSample ? ' Lỗi mẫu: <code style="background:#fff;padding:1px 4px;border-radius:3px">'+esc(String(errSample))+'</code>' : ''}</span>
    <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#991b1b;cursor:pointer;font-size:14px">✕</button>`;
  bar.prepend(banner);
}
function showSyncErrorBanner(msg) {
  const existing = document.getElementById('sync-err-banner');
  if (existing) existing.remove(); // luon thay bang thong bao MOI NHAT (ly do that co the doi — vd tu "chua deploy" sang "loi doc sheet don hang")
  const bar = document.getElementById('data-view');
  if (!bar) return;
  const banner = document.createElement('div');
  banner.id = 'sync-err-banner';
  banner.style.cssText = 'background:#fef2f2;border-bottom:1px solid #fca5a5;padding:7px 14px;font-size:12px;color:#991b1b;display:flex;align-items:center;gap:10px;flex-shrink:0;';
  banner.innerHTML = `
    <span>⚠ <strong>Auto-sync thất bại</strong> — ${msg ? esc(msg) : 'Apps Script chưa được deploy đúng ("Who has access: Anyone"). Data sẽ không tự cập nhật.'}</span>
    <button onclick="openGsModal()" style="padding:3px 10px;border-radius:4px;border:1px solid #fca5a5;background:#fff;color:#991b1b;font-size:11px;cursor:pointer;white-space:nowrap">Kiểm tra cài đặt</button>
    <button onclick="syncFromGS({pullOrders:true,manual:true})" style="padding:3px 10px;border-radius:4px;border:1px solid #fca5a5;background:#fff;color:#991b1b;font-size:11px;cursor:pointer;white-space:nowrap">↓ Sync thủ công</button>
    <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#991b1b;cursor:pointer;font-size:14px">✕</button>`;
  bar.insertBefore(banner, bar.firstChild);
}

async function pushCareToGS(phone) {
  if (!gsUrl) return;
  const care = careData[phone] || {};
  // Loc dung nhu _careRow(): chi day len Sheet lich CS tu tao tay hoac lich auto DA xu ly (Done).
  // Xem chu thich chi tiet o _careRow() phia tren — cung 1 ly do de tranh ghi de/hoi sinh lich
  // auto ma Duyen da xoa tay truc tiep tren CareData Sheet.
  const myScheds = schedules.filter(x => x.phone === phone && (!x.autoDao || x.done));
  const row = {
    phone,
    status: care.status||'', zalo: care.zalo||'', cs: care.cs||'', note: care.note||'',
    schedules: JSON.stringify(myScheds),
    schedGoi: care.schedGoi||'', schedGoiNote: care.schedGoiNote||'',
    schedSP: care.schedSP||'', schedSPNote: care.schedSPNote||'',
    schedCS: care.schedCS||'', schedCSNote: care.schedCSNote||'',
    schedHen: care.schedHen||'', schedHenNote: care.schedHenNote||'',
    khStatus: care.khStatus||'',
    nickZalos: care.nickZalos||[],
    zaloPhones: care.zaloPhones||[],
    tag: care.tag||'',
    name: care.name||'',
    custom: care.custom||{}
  };
  try {
    await fetch(gsUrl, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'saveSingle', row })
    });
  } catch(e) { console.warn('GS push failed', e); }
}


async function pushOrdersToGS() {
  if (!gsUrl) { toast('Chưa kết nối Google Sheets'); return; }
  if (!Object.keys(customerMap).length) { toast('Chưa có dữ liệu để đẩy'); return; }
  txt('ltext', 'Đang đẩy dữ liệu lên Google Sheets...');
  show('loverlay');
  try {
    const orders = [];
    for (const c of Object.values(customerMap)) {
      for (const o of c.orders) {
        orders.push({
          phone: c.phone, name: c.name,
          date: o.date instanceof Date ? o.date.toISOString() : (o.date||''),
          year: o.year||'', month: o.month||'',
          cs: o.cs||'', source: o.source||'', revenue: o.revenue||0,
          product: o.product||'', productDetail: o.productDetail||'',
          status: o.status||'', zalo: o.zalo||'', note: o.note||'',
          careCS: (typeof careData!=='undefined' && careData[c.phone] && careData[c.phone].cs) || _latestOrderCS(c.orders) || ''
        });
      }
    }
    const r = await fetch(gsUrl, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'saveOrders', orders })
    });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch(e) {
      hide('loverlay');
      toast('GAS trả về không phải JSON — kiểm tra quyền triển khai: Anyone');
      return;
    }
    hide('loverlay');
    if (d.error) { toast('Lỗi: ' + d.error); return; }
    toast(`✓ Đã thêm ${d.written} đơn hàng mới lên Google Sheets${d.skipped ? ` (${d.skipped} đơn đã có, bỏ qua)` : ''} — team có thể bấm "Sync GS" để xem`);
  } catch(e) {
    hide('loverlay');
    toast('Lỗi đẩy dữ liệu: ' + e.message);
  }
}

// Lấy nhanh số đơn đang có trên Google Sheets (cho màn hình xác nhận đồng bộ 2 chiều)
async function gsGetOrderCount() {
  if (!gsUrl) return null;
  try {
    const u = gsUrl + (gsUrl.includes('?') ? '&' : '?') + 'action=count';
    const r = await fetch(u, { redirect: 'follow' });
    const d = await r.json();
    if (d && typeof d.orderRows === 'number') return d.orderRows;
    return null;
  } catch(e) { return null; }
}

// ── ĐỒNG BỘ 2 CHIỀU OrderData: làm Google Sheets KHỚP CHÍNH XÁC dữ liệu đang có trên máy ──
async function fullSyncOrdersToGS() {
  if (!gsUrl) { toast('Chưa kết nối Google Sheets'); return; }
  if (!confirm('ĐỒNG BỘ 2 CHIỀU (GỘP đơn — KHÔNG xóa đơn nào):\n\n'
    + '①  TẢI mọi đơn từ Google Sheets về máy (gộp vào dữ liệu đang có)\n'
    + '②  ĐẨY các đơn mới trên máy lên Google Sheets\n\n'
    + 'Kết quả: cả máy và Sheet đều có đủ đơn của nhau, không đơn nào bị xóa.\n\nTiếp tục?')) return;
  // ① TẢI đơn từ Sheet → gộp vào máy (dùng luồng pull sẵn có: mergeRows + dựng lại danh sách)
  const beforePull = Object.values(customerMap).reduce((s,c)=>s+c.orders.length,0);
  await syncFromGS({ pullOrders: true, manual: true });
  const afterPull = Object.values(customerMap).reduce((s,c)=>s+c.orders.length,0);
  const pulled = Math.max(0, afterPull - beforePull);
  if (pulled > 0) toast('Đã tải & gộp ' + fmt(pulled) + ' đơn từ Sheet về máy. Đang đẩy đơn mới của máy lên...');
  // ② ĐẨY đơn mới của máy lên Sheet (append + chống trùng phía server, KHÔNG xóa)
  await pushOrdersToGS();
}

function handleFiles(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  e.target.value = '';
  // Giữ lại customerMap và loadedFiles cũ — chỉ merge thêm dữ liệu mới
  show('loverlay');
  setTimeout(() => processFiles(files), 60);
}

async function processFiles(files) {
  const prevCount = Object.keys(customerMap).length;
  for (const f of files) {
    txt('ltext', `Đang xử lý: ${f.name}`);
    await new Promise(resolve => {
      const r = new FileReader();
      r.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, {type:'array', cellDates:true});
          const rows = extractRows(wb, f.name);
          if (rows.length) {
            loadedFiles.push({name:f.name, rows:rows.length});
            mergeRows(rows);
          }
        } catch(err) { console.error(f.name, err); }
        resolve();
      };
      r.readAsArrayBuffer(f);
    });
  }
  buildCustomers();
  hide('loverlay');
  const newCount = Object.keys(customerMap).length;
  if (prevCount > 0) {
    const added = newCount - prevCount;
    toast(`✓ Đã tải thêm — ${added > 0 ? '+' + added + ' KH mới, ' : ''}tổng ${newCount} KH (dữ liệu cũ giữ nguyên)`);
  }
  if (gsUrl) {
    // sync-banner hidden
    show('syncbtn');
    show('pushbtn'); show('fullsyncbtn'); show('dupbtn');
    syncFromGS({ pullOrders: false });
  }
}

function extractRows(wb, fileName) {
  const fn = fileName.toLowerCase();
  let out = [];
  if (fn.includes('notion')) {
    for (const sh of wb.SheetNames) {
      if (['bảng','sheet2','p1','p2','p3','p4','p5','bản sao'].some(x=>sh.toLowerCase().includes(x))) continue;
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[sh], {header:1, defval:null});
      for (const r of raw) {
        if (!r || r.length < 9) continue;
        const src = s(r[8]);
        out.push(mkRow(r[1],r[2],r[3],r[4],r[5],r[6],src,r[9],guessProduct(s(r[13])),s(r[13]),s(r[14]),s(r[15]),s(r[16])));
      }
    }
    return out;
  }
  for (const sh of wb.SheetNames) {
    const sl = sh.toLowerCase();
    if (['tổng hợp','báo cáo','bảng','mẫu','data linh'].some(x=>sl.includes(x))) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], {defval:null});
    if (!rows.length) continue;
    const fr = rows[0];
    const srcCol = 'Nguồn đơn ' in fr ? 'Nguồn đơn ' : 'Nguồn đơn' in fr ? 'Nguồn đơn' : null;
    if (!srcCol) continue;
    for (const r of rows) {
      const src = s(r[srcCol]);
      // bỏ qua dòng rác (tổng hợp, tiền hàng, mã trạng thái nội bộ...)
      if (!src || src.length > 60 || /^\d{6,}$/.test(src) || src.startsWith('L5-') || src.startsWith('L7') || src.startsWith('L8') || src.startsWith('L9') || src.startsWith('L10') || src.includes('Tiền hàng') || src.includes('Số đơn')) continue;
      out.push(mkRow(
        r['Giờ đặt']||r['Giờ đặt đơn'], r['Năm'], r['Tháng'],
        r['Tên CS']||r['Tên cs']||r['Nhân viên'], r['Tên khách hàng'], r['Số điện thoại'],
        src, r['Doanh thu'], guessProduct(s(r['Sản phẩm chi tiết']||r['Sản phẩm'])),
        s(r['Sản phẩm chi tiết']||r['Sản phẩm']),
        s(r['Trạng thái chi tiết']||r['Trạng thái']),
        s(r['Zalo']||''), s(r['Note'])
      ));
    }
  }
  return out;
}

function mkRow(date,yr,mo,cs,name,phone,source,revenue,product,productDetail,status,zalo,note) {
  return {
    date:parseDate(date), year:parseYear(yr), month:parseNum(mo),
    cs:s(cs), name:s(name), phone:s(phone), source,
    revenue:_normRev(revenue), product, productDetail,
    status, zalo, note
  };
}

// CS của ĐƠN MỚI NHẤT — dùng làm mặc định cho "CS chăm sóc" khi chưa giao/đổi tay
function _latestOrderCS(orders){
  if (!orders || !orders.length) return '';
  var bestCS = '', bestT = -Infinity, lastCS = '';
  for (var i = 0; i < orders.length; i++){
    var o = orders[i];
    if (o.cs) lastCS = o.cs;          // giữ cs của đơn cuối mảng (dự phòng nếu không có ngày)
    var t = NaN;
    if (o.date instanceof Date) t = o.date.getTime();
    else if (o.date) { var pd = parseVNDate_(o.date); t = pd ? pd.getTime() : NaN; }
    if (isNaN(t) && o.year){ var yr = o.year < 100 ? 2000 + o.year : o.year; t = new Date(yr, (o.month||1)-1, 1).getTime(); }
    if (!isNaN(t) && o.cs && t >= bestT){ bestT = t; bestCS = o.cs; }
  }
  return bestCS || lastCS || '';
}
function buildCustomers() {
  // Tạo sẵn customerMap cho các SĐT chỉ có trong careData (chưa có đơn nào) — vd khách mới
  // được Pancake AI/Zalo AI phát hiện tên qua khung "Sản phẩm order" và lưu tên vào CareData
  // (cột 'name') — để khách này vẫn hiện trong danh sách CRM thay vì "biến mất" vì chưa từng
  // xuất hiện trong file Excel đơn hàng nào.
  if (typeof careData !== 'undefined' && careData) {
    Object.keys(careData).forEach(ph => {
      if (customerMap[ph]) return;
      const care = careData[ph] || {};
      if (!care.name) return; // không có tên thì chưa đủ thông tin để hiện như 1 khách hàng
      customerMap[ph] = {
        phone: ph, name: care.name, orders: [],
        sources: new Set(), brands: new Set(), _keys: new Set(),
        _rawStatus: care.status||'', _rawZalo: care.zalo||'', _rawNote: care.note||''
      };
    });
  }
  // Tạo sẵn customerMap cho các SĐT chỉ có ở nguồn "Chăm sóc" (sheet riêng, KH thêm nhanh
  // qua nút "+ Thêm KH/Đơn mới") — phòng trường hợp careData[phone] chưa kịp đồng bộ về máy
  // (careData giờ CŨNG được ghi trực tiếp khi thêm nhanh, xem submitQuickAddCustomer). Chỉ để KH này hiện trong
  // danh sách chính và gộp theo SĐT như bình thường nếu sau này có đơn thật.
  if (typeof careLeads !== 'undefined' && careLeads) {
    Object.keys(careLeads).forEach(ph => {
      if (customerMap[ph]) return;
      const lead = careLeads[ph] || {};
      if (!lead.name) return;
      customerMap[ph] = {
        phone: ph, name: lead.name, orders: [],
        sources: new Set(), brands: new Set(), _keys: new Set(),
        _rawStatus: '', _rawZalo: '', _rawNote: lead.note||''
      };
    });
  }
  // Tạo sẵn customerMap cho các SĐT chỉ có ở nguồn "CSKH-Duyên" (chưa có đơn nào / chưa có CareData) để CS thấy và
  // CHIA DATA được; nếu SĐT đã có ở DT tổng / dữ liệu đơn / Chăm sóc thì GIỮ NGUYÊN khách đó (gộp 1 khách theo SĐT).
  if (typeof cskhData !== 'undefined' && cskhData) {
    Object.keys(cskhData).forEach(ph => {
      if (customerMap[ph]) return;
      const rows = cskhData[ph] || [];
      const nm = (rows.find(r => r.name) || {}).name || ph; // không có tên → dùng SĐT (vẫn cần hiện để CS chia data / chăm sóc được)
      customerMap[ph] = {
        phone: ph, name: nm, orders: [],
        sources: new Set(), brands: new Set(), _keys: new Set(),
        _rawStatus: '', _rawZalo: '', _rawNote: ''
      };
    });
  }
  allCustomers = Object.values(customerMap).map(c => {
    // TONG DON / TONG DOANH THU: KH da co don POS -> theo POS (chuan, bo don hoan); chua co Pos -> theo Base nhu cu. Phan hang KH tinh tu rev nay.
    const tot = _custOrderCount_(c);
    const rev = _custRev_(c);

    // Chỉ đếm đơn từ 4 nguồn renew — dùng cho số "Renew" hiển thị ở trang chi tiết khách
    // (KHÔNG còn dùng để phân hạng KH, xem tiêu chí hạng mới ngay dưới đây)
    const renewOrders = c.orders.filter(o => RENEW_SOURCES.includes(s(o.source).toLowerCase()));
    const renewCount = renewOrders.length;

    // Tiêu chí phân hạng KH (mới): đếm theo SỐ ĐƠN trong sheet "dữ liệu đơn" (không còn theo
    // nguồn Renew ở DT tổng như trước) — 1 đơn = Chưa bán lại được, 2-4 = Tiềm năng,
    // 5-9 = Thân thiết, ≥10 = VIP.
    const donOrderCount = (typeof donOrderCountByPhone !== 'undefined' && donOrderCountByPhone) ? (donOrderCountByPhone[c.phone] || 0) : 0;
    let tier;
    if (donOrderCount >= 10) tier = 'VIP';
    else if (donOrderCount >= 5) tier = 'Thân thiết';
    else if (donOrderCount >= 2) tier = 'Tiềm năng';
    else tier = 'Chưa bán lại được';

    const care = careData[c.phone] || {};
    const careCS = care.cs || _latestOrderCS(c.orders);   // CS chăm sóc: mặc định theo đơn mới nhất
    const csSet = _buildCsSet_(c.orders, c.phone);  // CS phụ trách = người lên các đơn (DT tổng, tách nếu đơn có nhiều sale) + dữ liệu đơn
    // Nếu tên lấy từ đơn hàng chỉ là số điện thoại (chưa có tên thật trong đơn nào) nhưng
    // CareData đã có tên (vd Pancake AI/Zalo AI đọc được từ khung "Sản phẩm order") → dùng tên đó
    // Ten da luu tay (care.name) LUON uu tien hon ten tu nhan dien tu don hang — mot khi CS da
    // xac nhan/sua ten thi khong de ten tu dong (co the sai/rac) ghi de len nua.
    let displayName = care.name ? care.name : c.name;
    // Chưa có tên thật ở đâu cả (CareData lẫn đơn hàng) → tự động đoán từ dòng đầu cột
    // "Sản phẩm" của đơn gần nhất có thông tin hợp lệ, CHỈ để hiển thị (xem hàm ở trên).
    let nameGuessed = false;
    if (displayName === c.phone && typeof cskhData !== 'undefined' && cskhData && cskhData[c.phone]) {
      const _ckn = (cskhData[c.phone].find(r => r.name) || {}).name;
      if (_ckn) displayName = _ckn;
    }
    if (displayName === c.phone) {
      const guess = _guessNameForPhone(c.orders, c.phone);
      if (guess) { displayName = guess; nameGuessed = true; }
    }

    // Precompute year/month/hour cho mỗi đơn (dùng để lọc nhanh)
    const ymList = c.orders.map(o => {
      const oDate = o.date instanceof Date ? o.date : null;
      const oyr = o.year ? (o.year < 100 ? 2000 + o.year : o.year) : (oDate ? oDate.getFullYear() : null);
      const omo = o.month || (oDate ? oDate.getMonth()+1 : null);
      const ohr = oDate ? oDate.getHours() : null;
      const ods = oDate ? `${oDate.getFullYear()}-${String(oDate.getMonth()+1).padStart(2,'0')}-${String(oDate.getDate()).padStart(2,'0')}` : '';
      return { yr: oyr, mo: omo, hr: ohr, ds: ods };
    });

    // Nguồn dữ liệu đóng góp cho khách này (dùng cho bộ lọc "Nguồn dữ liệu" ở màn hình chính):
    // dt = có đơn trong DT tổng · cs = có bản ghi ở sheet Chăm sóc (KH thêm nhanh) · don = có trong "dữ liệu đơn"
    const dataSrc = {
      dt:  tot > 0,
      cs:  !!(typeof careLeads !== 'undefined' && careLeads && careLeads[c.phone]),
      don: !!(typeof donPhoneSet !== 'undefined' && donPhoneSet.has(c.phone)),
      cskh: !!(typeof cskhData !== 'undefined' && cskhData && cskhData[c.phone])
    };
    // Ngày mua gần nhất theo Pos (timestamp 00:00 local) — null nếu KH chưa có đơn Pos
    const _lpIso = (typeof donLastDateByPhone !== 'undefined' && donLastDateByPhone) ? donLastDateByPhone[c.phone] : '';
    const _lpM = _lpIso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(_lpIso) : null;
    const lastPosDate = _lpM ? new Date(+_lpM[1], +_lpM[2]-1, +_lpM[3]).getTime() : null;
    // Ten cua khach o nguon CSKH-Duyen (neu khac ten dang hien thi) — de o tim kiem khop duoc ca ten nay. Chi tao khi co, tranh ton bo nho cho ~134k KH.
    let cskhNameLower = '';
    { const _ckR = (typeof cskhData !== 'undefined' && cskhData) ? cskhData[c.phone] : null;
      if (_ckR) { const _dn = s(displayName).toLowerCase(); const _ex = _ckR.map(r => s(r.name).toLowerCase()).filter(n => n && n !== _dn); if (_ex.length) cskhNameLower = _ex.join('|'); } }

    return {
      ...c,
      lastPosDate,
      name: displayName,
      nameGuessed,
      cskh: (typeof cskhData !== 'undefined' && cskhData && cskhData[c.phone]) || [],   // dòng của khách này ở nguồn CSKH-Duyên (có thể >1 nếu trùng SĐT)
      sources:[...c.sources], brands:[...c.brands].filter(Boolean),
      totalOrders:tot, totalRevenue:rev,
      hangKey:_hangKeyOf_(rev), hang:HANG_LABEL[_hangKeyOf_(rev)],
      renewOrders:renewCount, tier,
      careStatus: care.status || c._rawStatus || '',
      zaloStatus: care.zalo || c._rawZalo || '',
      khStatus: care.khStatus || '',
      // Giá trị các trường tự tạo (admin thêm) — dùng cho lọc sidebar, cột bảng, badge, xuất Excel
      custom: (care.custom && typeof care.custom === 'object') ? care.custom : {},
      nickZalos: Array.isArray(care.nickZalos) ? care.nickZalos : [],
      zaloPhones: Array.isArray(care.zaloPhones) ? care.zaloPhones : [],
      careNote: care.note || c._rawNote || '',
      careCS,
      // Tách careCS thành các tên riêng lẻ (đề phòng ai đó gõ tay "A, B" vào ô CS chăm sóc) —
      // MỌI nơi lọc/so khớp theo CS chăm sóc phải dùng Set này thay vì so sánh chuỗi thô careCS,
      // để tránh sinh ra lựa chọn lọc dạng gộp "A, B" không cần thiết.
      careCSSet: new Set(splitMulti_(careCS, ',')),
      csSet,
      ymList,
      dataSrc,
      nameLower: s(displayName).toLowerCase(),
      cskhNameLower,
    };
  });
  // Compute _lastActionDate for each customer from careData + schedules done
  _computeLastActionDates();
  updateStats();
  updateSidebarCareFilters();
  updateSidebarBadges();
  updateBrandList();
  updateCSStaffList();
  updateCampaignFilter();
  applyFilters();
  updateFilesBar();
  updateSchedBadges();
  hide('empty-view');
  document.getElementById('data-view').style.display = 'flex';
  document.getElementById('clearbtn').style.display = '';
  txt('fstatus', `${fmt(allCustomers.length)} KH — ${loadedFiles.length} file`);
  if (gsUrl) { updateGsPill(true); show('syncbtn'); show('pushbtn'); show('fullsyncbtn'); show('dupbtn'); }
  if (typeof updateMyDataBadge === 'function') updateMyDataBadge();
}

// ═══════════════════════════════════════════════════════
//  FILTERS
// ═══════════════════════════════════════════════════════
function _computeLastActionDates() {
  // Build a map phone -> timestamp of last CS action
  // Sources: careData.updated (if present), done schedules, careNote/status set
  const actionMap = {};

  // 1. careData updated timestamp (từ GS sync có trường updated)
  for (const [phone, care] of Object.entries(careData)) {
    if (care.updated) {
      const t = new Date(care.updated).getTime();
      if (!isNaN(t)) actionMap[phone] = Math.max(actionMap[phone] || 0, t);
    }
    // Nếu có ghi chú hoặc trạng thái — coi là đã từng tác động
    if (care.status || care.note || care.cs || care.zalo) {
      // Không có timestamp riêng → dùng 1 để phân biệt với null (0)
      if (!actionMap[phone]) actionMap[phone] = 1;
    }
  }

  // 2. Done schedules — lấy ngày của lịch đã done
  for (const sc of schedules) {
    if (sc.done && sc.phone && sc.date) {
      const t = new Date(sc.date + 'T00:00:00').getTime();
      if (!isNaN(t)) actionMap[sc.phone] = Math.max(actionMap[sc.phone] || 0, t);
    }
  }

  // 3. Gắn vào allCustomers
  for (const c of allCustomers) {
    const t = actionMap[c.phone];
    c._lastActionDate = (t && t > 1) ? t : null; // null = chưa tác động
  }
}

function updateCampaignFilter() {
  const sel = document.getElementById('campaign-filter');
  if (!sel) return;
  const cur = sel.value;
  const csFList = _csFilterList();

  // Lọc chiến dịch theo CS đang chọn (nếu có) — multi: khớp BẤT KỲ CS nào trong danh sách
  const batches = (typeof assignHistory !== 'undefined' ? assignHistory : [])
    .filter(h => {
      if (!h.phones || h.phones.length === 0) return false;
      if (csFList.length && !csFList.includes(h.csName)) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  sel.innerHTML = '<option value="">Tất cả chiến dịch</option>' +
    batches.map(h => `<option value="${esc(h.id)}" ${h.id === cur ? 'selected' : ''}>📋 ${esc(h.label || h.csName)} · ${h.phones.length} KH · ${h.date.slice(0,10)}</option>`).join('');

  // Nếu chiến dịch đang chọn không còn trong danh sách → reset
  if (cur && !batches.find(h => h.id === cur)) {
    sel.value = '';
  }
}

function setTier(t,el) { currentTier=t; currentCare='all'; currentZalo='all'; currentBrand='all'; currentCF={}; activateBtn('.fi',el); resetSubFilters(); applyFilters(); }
function setCareFilter(t,el) { currentCare=t; activateBtn('#care-filters .section-btn',el); applyFilters(); }
function setZaloFilter(t,el) { currentZalo=t; activateBtn('#zalo-filters .section-btn',el); applyFilters(); }
function setBrand(b,el) { currentBrand=b; activateBtn('.bitem',el); applyFilters(); }
function clearDateFilter(){
  const f=document.getElementById('ymf-date-from'), t=document.getElementById('ymf-date-to');
  if (f) f.value=''; if (t) t.value='';
  applyFilters();
}
// Loc nhanh khoang ngay (chuan dung chung toan he thong: Hom nay/Hom qua/Tuan nay/Tuan truoc/
// Thang nay/Thang truoc) cho bo loc Nam/Thang/Ngay o danh sach KH chinh — dung lai _pkQuickRange
// (dinh nghia o khoi Pancake) de tinh khoang ngay, khong tu viet lai cong thuc.
function _ymfApplyQuickRange(key){
  if (key === 'custom') return;
  var r = (typeof _pkQuickRange === 'function') ? _pkQuickRange(key) : null;
  if (!r) return;
  var f = document.getElementById('ymf-date-from'), t = document.getElementById('ymf-date-to');
  if (f) f.value = r.from; if (t) t.value = r.to;
  applyFilters();
}
function activateBtn(sel,el) { document.querySelectorAll(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
function resetSubFilters() {
  currentBrand='all';
  currentCF={};
  document.querySelectorAll('#care-filters .section-btn').forEach((b,i)=>{ b.classList.remove('active'); if(i===0)b.classList.add('active'); });
  document.querySelectorAll('#zalo-filters .section-btn').forEach((b,i)=>{ b.classList.remove('active'); if(i===0)b.classList.add('active'); });
  document.querySelectorAll('.bitem').forEach((b,i)=>{ b.classList.remove('active'); if(i===0)b.classList.add('active'); });
  // Mỗi nhóm trường tự tạo: bỏ active hết rồi active lại nút "Tất cả" (nút đầu tiên của nhóm)
  document.querySelectorAll('.cf-filter-group').forEach(function(g){
    g.querySelectorAll('.section-btn').forEach(function(b,i){ b.classList.remove('active'); if(i===0) b.classList.add('active'); });
  });
}

function debouncedApplyFilters() {
  clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(applyFilters, 300);
}

function applyFilters() {
  const q = s(document.getElementById('search-input').value).toLowerCase();
  const sort = document.querySelector('.srt').value;
  const csFList = _csFilterList();
  const dataSrcF = document.getElementById('datasrc-filter')?.value || 'all';
  const ymYear = document.getElementById('ymf-year')?.value || '';
  const ymMonth = document.getElementById('ymf-month')?.value || '';
  const hourFrom = document.getElementById('ymf-hour-from')?.value;
  const hourTo = document.getElementById('ymf-hour-to')?.value;
  const dateFrom = document.getElementById('ymf-date-from')?.value || '';
  const dateTo = document.getElementById('ymf-date-to')?.value || '';
  const campaignF = document.getElementById('campaign-filter')?.value || '';
  const noActionF = document.getElementById('no-action-filter')?.checked || false;

  // Update year/month selector styling
  const yel = document.getElementById('ymf-year'), mel = document.getElementById('ymf-month');
  const hfEl = document.getElementById('ymf-hour-from'), htEl = document.getElementById('ymf-hour-to');
  if (yel) yel.className = 'ymf-sel' + (ymYear ? ' ymf-active' : '');
  if (mel) mel.className = 'ymf-sel' + (ymMonth ? ' ymf-active' : '');
  if (hfEl) hfEl.className = 'ymf-sel' + (hourFrom ? ' ymf-active' : '');
  if (htEl) htEl.className = 'ymf-sel' + (hourTo ? ' ymf-active' : '');
  const dfEl = document.getElementById('ymf-date-from'), dtEl = document.getElementById('ymf-date-to');
  if (dfEl) dfEl.className = 'ymf-date' + (dateFrom ? ' ymf-active' : '');
  if (dtEl) dtEl.className = 'ymf-date' + (dateTo ? ' ymf-active' : '');
  const clrDate = document.getElementById('ymf-clear-date');
  if (clrDate) clrDate.style.display = (dateFrom || dateTo) ? '' : 'none';

  // Build campaign phone set (normalize để tránh lỗi format)
  let campaignPhones = null;
  if (campaignF) {
    const batch = (typeof assignHistory !== 'undefined' ? assignHistory : []).find(h => h.id === campaignF);
    if (batch && batch.phones && batch.phones.length > 0) {
      campaignPhones = new Set(batch.phones.map(p => { const _n = (typeof normPhone === 'function') ? normPhone(p) : null; return _n || String(p).replace(/[\s\-]/g,''); }));
      console.log('[campaign filter] batch:', batch.label, '| phones:', batch.phones.length, '| sample:', batch.phones.slice(0,3));
    } else if (campaignF) {
      // batch tồn tại nhưng phones rỗng hoặc không tìm thấy → hiện 0 KH
      campaignPhones = new Set();
      console.warn('[campaign filter] batch not found or empty for id:', campaignF);
    }
  }

  // Nếu query toàn số >= 4 ký tự → tìm SĐT, bỏ qua tất cả bộ lọc khác
  const isPhoneSearch = q && /^\d{4,}$/.test(q);
  if (isPhoneSearch) {
    const pList = allCustomers.filter(c => c.phone.includes(q));
    renderTable(pList);
    txt('result-count', fmt(pList.length));
    txt('tb-list', fmt(pList.length));
    return;
  }

  let list = allCustomers.filter(c => {
    if (!_inUserScope(c)) return false;            // V9: phân quyền theo vai trò
    if (currentTier !== 'all' && c.tier !== currentTier) return false;
    if (currentCare !== 'all' && c.careStatus !== currentCare) return false;
    if (currentZalo !== 'all') {
      if (currentZalo === 'block') { if (!['Chặn','Hủy kết bạn'].includes(c.zaloStatus)) return false; }
      else if (c.zaloStatus !== currentZalo) return false;
    }
    // Lọc theo TRƯỜNG TỰ TẠO (sidebar) — khách phải khớp TẤT CẢ trường đang được lọc (AND)
    for (var _cfId in currentCF) {
      if (((c.custom && c.custom[_cfId]) || '') !== currentCF[_cfId]) return false;
    }
    if (csFList.length) {
      // Lọc theo (các) CS đang chọn + ĐÚNG chế độ (Phụ trách / Chăm sóc / Cả hai)
      // Multi: khớp nếu khách thuộc về BẤT KỲ CS nào trong danh sách đã chọn (OR)
      const _allH = (typeof _assignAllIndex !== 'undefined') ? _assignAllIndex[c.phone] : null;
      let _matchAnyCS = false;
      for (let _k = 0; _k < csFList.length; _k++) {   // vòng for thay .some(closure): không cấp phát hàm cho từng khách trong 136k khách
        const csF = csFList[_k];
        const _inOrders = c.csSet.has(csF);
        const _inCare   = !!(c.careCSSet && c.careCSSet.has(csF));
        // Tra cứu O(1) qua _assignAllIndex: KH có trong chiến dịch nào của CS không (chỉ tính ở chế độ "Cả hai")
        const _inAssign = _allH ? _allH.has(csF) : false;
        if (_csModeMatch(_inOrders, _inCare, _inAssign)) { _matchAnyCS = true; break; }
      }
      if (!_matchAnyCS) return false;
    }
    if (q && !c.nameLower.includes(q) && !c.phone.includes(q) && !(c.cskhNameLower && c.cskhNameLower.includes(q))) return false;

    // Lọc theo nguồn dữ liệu (DT tổng / Chăm sóc / Dữ liệu đơn / Chia data) — mặc định "Gộp" = không lọc
    if (dataSrcF !== 'all') {
      const src = c.dataSrc || {};
      if (dataSrcF === 'dt'  && !src.dt)  return false;
      if (dataSrcF === 'cs'  && !src.cs)  return false;
      if (dataSrcF === 'don' && !src.don) return false;
      if (dataSrcF === 'cskh' && !src.cskh) return false;
      // "Chia data": KH đang nằm trong (các) đợt phân công (sheet AssignData) của CHÍNH tài
      // khoản đang đăng nhập — tra qua _assignAllIndex (phone -> Set<csName>) giống hệt cách
      // bộ lọc CS ở trên đang dùng, không bake vào c.dataSrc vì AssignData có thể được tải/đổi
      // mà không rebuild lại toàn bộ danh sách khách.
      if (dataSrcF === 'assign') {
        const _aIdx = (typeof _assignAllIndex !== 'undefined') ? _assignAllIndex[c.phone] : null;
        if (!_aIdx || !_aIdx.size) return false;
        // SUA 2026-10-05: truoc day chi so voi currentUser.name (1 ten) nen tai khoan co NHIEU ten (currentUser.names) hoac
        // Admin (ten 'Admin' khong trung ten CS nao trong AssignData) luon ra 0 du da chia data. Nay so voi MOI ten cua
        // tai khoan (giong _inUserScope); Admin khong gan ten CS nao thi hien moi KH dang nam trong bat ky dot chia nao.
        const _myN = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name ? [currentUser.name] : []);
        const _isRealCs = _myN.some(n => n && n !== 'Admin');
        if (_isRealCs || currentUser.role !== 'admin') {
          if (!_myN.some(n => _aIdx.has(n))) return false;
        }
      }
    }

    // Campaign filter (normalize phone để tránh lỗi khoảng trắng/dấu gạch)
    if (campaignPhones !== null && !campaignPhones.has(String(c.phone).replace(/[\s\-]/g,''))) return false;

    // No-action filter: chưa có _lastActionDate
    if (noActionF && c._lastActionDate) return false;

    // Column filters
    if (colFilters.name.size > 0 && !colFilters.name.has(c.name)) return false;
    if (colFilters.tier.size > 0 && !colFilters.tier.has(c.tier)) return false;
    if (colFilters.hang.size > 0 && !colFilters.hang.has(c.hang)) return false;
    if (colFilters.care.size > 0 && !colFilters.care.has(c.careStatus || '')) return false;
    if (colFilters.zalo.size > 0 && !colFilters.zalo.has(c.zaloStatus || '')) return false;
    if (colFilters.product.size > 0) {
      const wantBlank = colFilters.product.has('');
      const hasMatch = [...colFilters.product].some(p=>p && c.brands.includes(p));
      if (!hasMatch && !(wantBlank && c.brands.length === 0)) return false;
    }
    if (colFilters.source.size > 0 && ![...colFilters.source].some(src=>c.sources.includes(src))) return false;
    if (colFilters.cs.size > 0) {
      if (![...colFilters.cs].some(n=>c.csSet.has(n))) return false;
    }
    if (colFilters.careCS.size > 0) {
      if (!c.careCSSet || ![...c.careCSSet].some(n=>colFilters.careCS.has(n))) return false;
    }

    // Column filter: lịch kế tiếp (sched)
    if (colFilters.sched.size > 0) {
      const ns = nextSched(c.phone);
      const hasAny = ns != null;
      const matchSched = [...colFilters.sched].some(v => {
        if (v === 'Có lịch') return hasAny;
        if (v === 'Không có lịch') return !hasAny;
        // Lọc theo loại lịch (label của SCHED_TYPES)
        if (hasAny) {
          const st = SCHED_TYPES.find(t=>t.label===v);
          return st && ns.type === st.key;
        }
        return false;
      });
      if (!matchSched) return false;
    }

    // Column filter: ngày mua gần nhất (Pos)
    if (colFilters.lastpos.size > 0) {
      const lp = c.lastPosDate;
      const lpDa = lp ? _calendarDaysAgo(lp) : null;
      const matchLP = [...colFilters.lastpos].some(v => {
        if (v === 'Chưa có đơn Pos') return !lp;
        if (!lp) return false;
        if (v === 'Hôm nay') return lpDa === 0;
        if (v === '≤ 7 ngày') return lpDa <= 7;
        if (v === '≤ 30 ngày') return lpDa <= 30;
        if (v === '≤ 90 ngày') return lpDa <= 90;
        if (v === '> 90 ngày') return lpDa > 90;
        if (v.startsWith('daterange:')) {
          const parts = v.replace('daterange:','').split('_');
          const df = parts[0] ? new Date(parts[0]+'T00:00:00').getTime() : null;
          const dt = parts[1] ? new Date(parts[1]+'T23:59:59').getTime() : null;
          if (df && lp < df) return false;
          if (dt && lp > dt) return false;
          return true;
        }
        return false;
      });
      if (!matchLP) return false;
    }

    // Column filter: lần tác động (lastact — số ngày trước)
    if (colFilters.lastact.size > 0) {
      const la = c._lastActionDate;
      const daysAgo = la ? _calendarDaysAgo(la) : null;
      const matchLA = [...colFilters.lastact].some(v => {
        if (!v || v === '__custom_range__') return false;
        if (v === 'Chưa tác động') return !la;
        if (!la) return false;
        if (v.startsWith('range:')) {
          const parts = v.replace('range:','').split('-');
          const f = parts[0] !== '' ? parseInt(parts[0]) : 0;
          const t = parts[1] !== '' ? parseInt(parts[1]) : 99999;
          return daysAgo >= f && daysAgo <= t;
        }
        if (v === 'Hôm nay') return daysAgo === 0;
        if (v === 'Hôm qua') return daysAgo === 1;
        if (v === '≤ 3 ngày') return daysAgo <= 3;
        if (v === '≤ 7 ngày') return daysAgo <= 7;
        if (v === '≤ 14 ngày') return daysAgo <= 14;
        if (v === '≤ 30 ngày') return daysAgo <= 30;
        if (v === '> 30 ngày') return daysAgo > 30;
        return false;
      });
      if (!matchLA) return false;
    }

    // Column filter: thời gian tác động chính xác (tacdong — từ careData.updated)
    if (colFilters.tacdong.size > 0) {
      const _upd = (typeof careData !== 'undefined' && careData[c.phone]) ? careData[c.phone].updated : '';
      const _tdTs = _upd ? new Date(_upd).getTime() : (c._lastActionDate || null);
      const tdAgo = _tdTs ? _calendarDaysAgo(_tdTs) : null;
      const tdH = _tdTs ? Math.floor((Date.now() - _tdTs) / 3600000) : null;
      const matchTD = [...colFilters.tacdong].some(v => {
        if (v === 'Chưa có') return !_tdTs;
        if (!_tdTs) return false;
        if (v === 'Trong 24h') return tdH !== null && tdH < 24;
        if (v === 'Hôm nay') return tdAgo === 0;
        if (v === 'Hôm qua') return tdAgo === 1;
        if (v === '≤ 3 ngày') return tdAgo <= 3;
        if (v === '≤ 7 ngày') return tdAgo <= 7;
        if (v === '> 7 ngày') return tdAgo > 7;
        return false;
      });
      if (!matchTD) return false;
    }

    // Column filter: trạng thái gửi TN chiến dịch bắn (bcstatus)
    if (colFilters.bcstatus.size > 0) {
      const _bcr = _bcStatusForPhone(c.phone);
      let _bcCat;
      if (!_bcr) _bcCat = 'Không trong chiến dịch';
      else {
        const _st = String(_bcr.status || '');
        if (_st === 'sent') _bcCat = 'Đã gửi';
        else if (_st.startsWith('failed')) _bcCat = 'Gửi lỗi';
        else if (_st.startsWith('skip')) _bcCat = 'Bỏ qua';
        else _bcCat = 'Chưa gửi';
      }
      if (!colFilters.bcstatus.has(_bcCat)) return false;
    }

    // Year/month filter on orders
    if (ymYear || ymMonth || hourFrom !== '' || hourTo !== '') {
      const yr = ymYear ? parseInt(ymYear) : null;
      const mo = ymMonth ? parseInt(ymMonth) : null;
      const hf = hourFrom !== '' && hourFrom !== undefined ? parseInt(hourFrom) : null;
      const ht = hourTo !== '' && hourTo !== undefined ? parseInt(hourTo) : null;
      const hasMatch = c.ymList.some(o => {
        if (yr && o.yr !== yr) return false;
        if (mo && o.mo !== mo) return false;
        if (hf !== null && o.hr !== null && o.hr < hf) return false;
        if (ht !== null && o.hr !== null && o.hr > ht) return false;
        return true;
      });
      if (!hasMatch) return false;
    }

    // Date-range filter on orders (từ ngày – đến ngày)
    if (dateFrom || dateTo) {
      const hasDate = c.ymList.some(o => {
        if (!o.ds) return false;
        if (dateFrom && o.ds < dateFrom) return false;
        if (dateTo && o.ds > dateTo) return false;
        return true;
      });
      if (!hasDate) return false;
    }

    // Advanced filters
    if (advFilters.cs.size > 0) {
      if (![...advFilters.cs].some(n=>c.csSet.has(n) || (c.careCSSet && c.careCSSet.has(n)))) return false;  // khớp cả CS phụ trách lẫn CS chăm sóc
    }
    if (advFilters.products.size > 0) {
      const terms = [...advFilters.products].map(t=>_foldVi(t)).filter(Boolean);
      const ptxt = _customerProductText(c);
      if (!terms.some(t=>ptxt.indexOf(t) !== -1)) return false;
    }
    if (advFilters.sources.size > 0 && ![...advFilters.sources].some(src=>c.sources.includes(src))) return false;
    if (advFilters.careStatus.size > 0 && !advFilters.careStatus.has(c.careStatus || '')) return false;
    if (advFilters.zaloStatus.size > 0 && !advFilters.zaloStatus.has(c.zaloStatus || '')) return false;
    // Trường tự tạo: với mỗi trường có chọn chip, khách phải khớp 1 trong các giá trị đã chọn
    for (var _acfId in (advFilters.custom || {})) {
      var _acfSet = advFilters.custom[_acfId];
      if (_acfSet && _acfSet.size > 0 && !_acfSet.has((c.custom && c.custom[_acfId]) || '')) return false;
    }
    if (advFilters.yearFrom || advFilters.monthFrom || advFilters.yearTo || advFilters.monthTo) {
      const yfr = advFilters.yearFrom ? parseInt(advFilters.yearFrom) : null;
      const mfr = advFilters.monthFrom ? parseInt(advFilters.monthFrom) : null;
      const yto = advFilters.yearTo ? parseInt(advFilters.yearTo) : null;
      const mto = advFilters.monthTo ? parseInt(advFilters.monthTo) : null;
      const hasAdv = c.ymList.some(o => {
        if (!o.yr) return false;
        const oVal = o.yr * 100 + (o.mo || 0);
        const frVal = yfr ? yfr * 100 + (mfr || 0) : 0;
        const toVal = yto ? yto * 100 + (mto || 12) : 999999;
        return oVal >= frVal && oVal <= toVal;
      });
      if (!hasAdv) return false;
    }
    return true;
  });

  if (_lastPosSortDir !== 0) {
    // Mua gan nhat: KH chua co don Pos nao (lastPosDate rong) luon xep CUOI du dang sap xep chieu nao.
    list.sort((a, b) => {
      const da = a.lastPosDate, db = b.lastPosDate;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return _lastPosSortDir === -1 ? db - da : da - db;
    });
  } else if (_lastActSortDir !== 0) {
    list.sort((a, b) => {
      const da = a._lastActionDate || 0;
      const db = b._lastActionDate || 0;
      return _lastActSortDir === -1 ? db - da : da - db;
    });
  } else if (sort==='lastact_asc') list.sort((a,b)=>(a._lastActionDate||0)-(b._lastActionDate||0));
  else if (sort==='lastpos_desc') list.sort((a,b)=>(b.lastPosDate||0)-(a.lastPosDate||0));
  else if (sort==='lastpos_asc') list.sort((a,b)=>(a.lastPosDate||Infinity)-(b.lastPosDate||Infinity));
  else if (sort==='lastact_desc') list.sort((a,b)=>(b._lastActionDate||0)-(a._lastActionDate||0));
  else if (sort==='orders_desc') list.sort((a,b)=>b.totalOrders-a.totalOrders);
  else if (sort==='orders_asc') list.sort((a,b)=>a.totalOrders-b.totalOrders);
  else if (sort==='revenue_desc') list.sort((a,b)=>b.totalRevenue-a.totalRevenue);
  else if (sort==='name_asc') list.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  else if (sort==='sched_asc') {
    list.sort((a,b)=>{
      const na=nextSched(a.phone), nb=nextSched(b.phone);
      if(na&&nb) return new Date(na.date)-new Date(nb.date);
      return na?-1:nb?1:0;
    });
  }
  _lastFilteredList = list.map(c => c.phone);
  _lastFilteredObjs = list;
  try { window.__omeFiltered = list; } catch(e){}   // mirror ra window (chia sẻ chắc chắn giữa các <script> block)
  if (typeof _filterCache === 'object') { _filterCache.sig = _filterSignature(); _filterCache.list = list; }
  renderTable(list);
  txt('result-count', fmt(list.length));
  txt('tb-list', fmt(list.length));

  // Update year/month label
  const ymLabel = document.getElementById('ymf-count-label');
  if (ymLabel) {
    const hasAny = ymYear || ymMonth || hourFrom || hourTo || dateFrom || dateTo;
    ymLabel.textContent = hasAny ? `→ ${fmt(list.length)} KH khớp` : '';
  }

  // Update campaign label
  const campLabel = document.getElementById('campaign-count-label');
  if (campLabel) campLabel.textContent = (campaignF || noActionF) ? `→ ${fmt(list.length)} KH` : '';

  // Update advanced filter badge
  const advCount = countAdvFilters();
  const btn = document.getElementById('adv-filter-btn');
  if (btn) {
    const existing = btn.querySelector('.adv-filter-active-badge');
    if (existing) existing.remove();
    if (advCount > 0) {
      btn.innerHTML = `⚙ Lọc nâng cao <span class="adv-filter-active-badge">${advCount}</span>`;
    } else {
      btn.innerHTML = '⚙ Lọc nâng cao';
    }
  }
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
}

// ═══════════════════════════════════════════════════════
//  TABLE
// ═══════════════════════════════════════════════════════
// ── HTML cho 1 dòng KH (tách riêng để virtual table tái sử dụng) ──
function _rowHtml(c) {
  const tb = tierBadge(c.tier);
  const cb = careBadge(c.careStatus);
  const zb = zaloBadge(c.zaloStatus);
  const khSt = (careData[c.phone] && careData[c.phone].khStatus) || '';
  const khb = khSt ? custStatusBadge(khSt) : '';
  const brandTags = c.brands.slice(0,3).map(b=>`<span class="btag">${esc(b)}</span>`).join('');
  const extra = c.brands.length>3?`<span class="btag">+${c.brands.length-3}</span>`:'';
  const csNames = [..._buildCsSet_(c.orders, c.phone)];   // CS phụ trách = người lên đơn
  const csBadges = csNames.slice(0,3).map(n=>`<span class="cs-badge">${esc(n)}</span>`).join('');
  const csExtra = csNames.length>3?`<span class="cs-badge">+${csNames.length-3}</span>`:'';
  const csHtml = csNames.length ? `<div class="cs-badge-wrap">${csBadges}${csExtra}</div>` : '<span style="color:var(--hint);font-size:11px">—</span>';
  const careCSHtml = c.careCS ? `<span class="cs-badge" style="background:var(--green-bg);color:var(--green)">${esc(c.careCS)}</span>` : '<span style="color:var(--hint);font-size:11px">—</span>';
  const srcTags = c.sources.slice(0,2).map(x=>`<span class="btag">${esc(x)}</span>`).join('');
  const srcExtra = c.sources.length>2?`<span class="btag">+${c.sources.length-2}</span>`:'';
  // Ghi chú gần nhất (cache để khỏi sort lại mỗi lần scroll)
  if (c._latestNote === undefined) {
    const sortedOrders = [...c.orders].sort((a,b) => {
      const da = a.date instanceof Date ? a.date.getTime() : (a.year||0)*10000+(a.month||0)*100;
      const db = b.date instanceof Date ? b.date.getTime() : (b.year||0)*10000+(b.month||0)*100;
      return db - da;
    });
    c._latestNote = sortedOrders.find(o => o.note)?.note || '';
  }
  const rawNote = c.careNote || c._latestNote || '';
  const latestNoteText = _latestNoteText(rawNote);
  const noteStr = latestNoteText ? esc(latestNoteText.substring(0,60)) + (latestNoteText.length>60?'…':'') : '—';
  const noteTitle = latestNoteText ? esc(latestNoteText) : '';
  const ns = nextSched(c.phone);
  const nsHtml = ns
    ? `<span style="color:${isOverdue(ns)?'var(--red)':'#2563eb'};font-size:11px">${schedTypeLabel(ns.type)} · ${fmtDate(ns.date)}</span>`
    : '<span style="color:var(--hint);font-size:11px">—</span>';
  const srcDisp = (typeof colVisible !== 'undefined' && colVisible.source) ? '' : 'display:none';
  const bcDisp = (typeof colVisible !== 'undefined' && colVisible.bcstatus !== false) ? '' : 'display:none';
  const lastActDisp = (typeof colVisible !== 'undefined' && colVisible.lastact !== false) ? '' : 'display:none';
  // Lần tác động gần nhất: lấy từ careData.updated hoặc schedules done hoặc careNote update
  const lastActDate = c._lastActionDate; // precomputed in buildCustomers
  let lastActHtml;
  if (lastActDate) {
    const daysAgo = _calendarDaysAgo(lastActDate);
    const color = daysAgo <= 3 ? 'var(--green)' : daysAgo <= 14 ? 'var(--tn)' : 'var(--hint)';
    const label = daysAgo === 0 ? 'Hôm nay' : daysAgo === 1 ? 'Hôm qua' : `${daysAgo} ngày trước`;
    lastActHtml = `<span style="color:${color};font-size:11px" title="${new Date(lastActDate).toLocaleDateString('vi-VN')}">${label}</span>`;
  } else {
    lastActHtml = `<span style="color:var(--red);font-size:11px;font-weight:500">Chưa tác động</span>`;
  }
  // Thời gian tác động (chính xác, theo thời gian thực): ưu tiên careData.updated
  const tacdongDisp = (typeof colVisible !== 'undefined' && colVisible.tacdong !== false) ? '' : 'display:none';
  const _upd = (typeof careData !== 'undefined' && careData[c.phone]) ? careData[c.phone].updated : '';
  const _af = _fmtActTime(_upd || lastActDate);
  let tacdongHtml;
  if (_af) {
    const _rel = _relTime(_af.t);
    const _recent = _isToday(_af.t);
    const _col = _recent ? 'var(--green)' : 'var(--muted)';
    tacdongHtml = `<span style="color:${_col};font-size:11px;white-space:nowrap" title="${_af.full} • ${_rel}">${_af.abs}</span>`;
  } else {
    tacdongHtml = `<span style="color:var(--hint);font-size:11px">—</span>`;
  }
  const lastPosDisp = (typeof colVisible !== 'undefined' && colVisible.lastpos !== false) ? '' : 'display:none';
  let lastPosHtml;
  if (c.lastPosDate) {
    const _lpDa = _calendarDaysAgo(c.lastPosDate);
    const _lpCol = _lpDa <= 30 ? 'var(--green)' : _lpDa <= 90 ? 'var(--tn)' : 'var(--hint)';
    lastPosHtml = `<span style="color:${_lpCol};font-size:12px;font-weight:600;white-space:nowrap" title="${_lpDa === 0 ? 'Hôm nay' : _lpDa + ' ngày trước'} (đơn Pos)">${new Date(c.lastPosDate).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>`;
  } else {
    lastPosHtml = '<span style="color:var(--hint);font-size:11px">—</span>';
  }
  return `<tr data-phone="${esc(c.phone)}" onclick="openDp(this.dataset.phone)">
    <td class="col-lastpos" style="${lastPosDisp}">${lastPosHtml}</td>
    <td class="col-name"><div class="cname">${esc(c.name)}</div><div class="cphone" style="display:flex;align-items:center;gap:4px">${c.phone}<button data-phone="${esc(c.phone)}" onclick="event.stopPropagation();copyPhone(this.dataset.phone)" title="Copy SĐT" style="background:none;border:none;cursor:pointer;font-size:11px;padding:0 2px;color:var(--hint);line-height:1;opacity:.6" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.6'">📋</button></div></td>
    <td class="col-tier">${tb}</td>
    <td class="col-hang">${hangBadge(c.hangKey)}</td>
    <td class="col-care">${cb}${khb ? '<br>'+khb : ''}</td>
    <td class="col-zalo">${zb}</td>
    <td class="col-order"><span style="font-weight:600">${c.totalOrders}</span><span style="color:var(--muted);font-size:11px"> / ${fmtVND(c.totalRevenue)}</span></td>
    <td class="col-product"><div class="btags">${brandTags}${extra}</div></td>
    <td class="col-cs">${csHtml}</td>
    <td class="col-carecs">${careCSHtml}</td>
    <td class="col-source" style="${srcDisp}"><div class="btags">${srcTags}${srcExtra}</div></td>
    <td class="col-bcstatus" data-phone="${esc(c.phone)}" style="cursor:pointer;${bcDisp}" onclick="event.stopPropagation();openBcLogModal(this.dataset.phone)" title="Nhấn để xem log gửi TN của khách này">${_bcStatusBadge(c.phone)}</td>
    <td class="col-note" style="font-size:11px;color:var(--muted)" title="${noteTitle}">${noteStr}</td>
    <td class="col-sched">${nsHtml}</td>
    <td class="col-lastact" style="${lastActDisp}">${lastActHtml}</td>
    <td class="col-tacdong" style="${tacdongDisp}">${tacdongHtml}</td>
    ${_cfRowCells(c)}
  </tr>`;
}

// ── Cột động cho TRƯỜNG TỰ TẠO trong bảng danh sách ──
// Cột được chèn thêm vào cuối mỗi hàng; phần <th> tương ứng do _cfSyncTableHead() chèn vào thead.
// Mỗi cột dùng class col-cf_<id> để dùng chung cơ chế ẩn/hiện colVisible sẵn có.
function _cfRowCells(c) {
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) return '';
  return CUSTOM_FIELDS.map(function(f){
    var key = 'cf_' + f.id;
    var vis = (typeof colVisible !== 'undefined' && colVisible[key] === false) ? 'display:none' : '';
    var v = (c.custom && c.custom[f.id]) || '';
    return '<td class="col-' + esc(key) + '" style="font-size:11px;' + vis + '">'
      + (v ? '<span class="cf-cell-badge">' + esc(v) + '</span>' : '<span style="color:var(--hint)">—</span>')
      + '</td>';
  }).join('');
}

// Chèn/đồng bộ các <th> của trường tự tạo vào thead (gọi trước mỗi lần vẽ bảng)
function _cfSyncTableHead() {
  var head = document.querySelector('#main-table thead tr');
  if (!head) return;
  // Xoá các th cũ của trường tự tạo rồi chèn lại theo đúng danh sách hiện tại
  head.querySelectorAll('th[data-cf-th]').forEach(function(th){ th.remove(); });
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) return;
  CUSTOM_FIELDS.forEach(function(f){
    var key = 'cf_' + f.id;
    var th = document.createElement('th');
    th.className = 'col-' + key;
    th.setAttribute('data-cf-th', f.id);
    if (typeof colVisible !== 'undefined' && colVisible[key] === false) th.style.display = 'none';
    th.innerHTML = '<div class="th-inner">' + esc(f.label) + '</div>';
    head.appendChild(th);
  });
}

// Chèn/đồng bộ các chip bật-tắt cột của trường tự tạo vào thanh "📋 Cột hiển thị"
function _cfSyncColToggles() {
  var bar = document.getElementById('col-toggle-bar');
  if (!bar) return;
  bar.querySelectorAll('[data-cf-chip]').forEach(function(el){ el.remove(); });
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) return;
  CUSTOM_FIELDS.forEach(function(f){
    var key = 'cf_' + f.id;
    if (!(key in colVisible)) colVisible[key] = true;   // mặc định hiện khi admin vừa tạo trường
    var lb = document.createElement('label');
    lb.className = 'col-toggle-chip';
    lb.setAttribute('data-cf-chip', f.id);
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = colVisible[key] !== false;
    cb.addEventListener('change', function(){ toggleCol(key, cb); });
    lb.appendChild(cb);
    lb.appendChild(document.createTextNode(' ' + f.label));
    // Chèn trước dải phân cách/chip "Chưa tác động" ở cuối thanh
    var sep = bar.querySelector('#no-action-chip');
    if (sep) bar.insertBefore(lb, sep.previousSibling || sep); else bar.appendChild(lb);
  });
}

function _vtWrap() { return document.querySelector('#tab-list .table-wrap'); }

function renderTable(list) {
  // Đồng bộ cột động của trường tự tạo trước khi vẽ (admin có thể vừa thêm/xoá trường)
  try { _cfSyncTableHead(); _cfSyncColToggles(); } catch(e){}
  // Chữ ký danh sách hiện tại: dùng để phân biệt "đổi bộ lọc thật sự" (nên cuộn về đầu)
  // với "vẽ lại do đồng bộ dữ liệu nền / quay lại tab" (nên giữ nguyên vị trí cuộn).
  const sig = list.length + '|' + (list[0] ? list[0].phone : '') + '|' + (list[list.length-1] ? list[list.length-1].phone : '');
  const sameList = (_vt.sig === sig);
  _vt.sig = sig;
  _vt.list = list;
  try { window.__omeFiltered = list; } catch(e){}   // MỌI lần bảng vẽ đều ghi danh sách đang hiển thị ra window (nguồn chắc chắn cho Chia data)
  _vt.lastStart = -1; _vt.lastEnd = -1;
  const wrap = _vtWrap();
  const prevScroll = wrap ? wrap.scrollTop : 0;
  if (wrap) wrap.scrollTop = sameList ? prevScroll : 0;   // giữ vị trí cuộn nếu danh sách không đổi, về đầu nếu đổi bộ lọc
  if (!_vt.bound && wrap) {
    wrap.addEventListener('scroll', () => {
      if (_vt.raf) return;
      _vt.raf = requestAnimationFrame(() => { _vt.raf = null; _renderVirtualWindow(); });
    }, { passive: true });
    _vt.bound = true;
  }
  _renderVirtualWindow(true);
}

function _renderVirtualWindow(force) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  const list = _vt.list;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:32px;color:var(--hint)">Không có kết quả</td></tr>';
    return;
  }
  const wrap = _vtWrap();
  const scrollTop = wrap ? wrap.scrollTop : 0;
  const vpH = wrap ? wrap.clientHeight : 600;
  const total = list.length;
  let start = Math.max(0, Math.floor(scrollTop / VT_ROW_H) - VT_BUFFER);
  const visible = Math.ceil(vpH / VT_ROW_H) + VT_BUFFER * 2;
  let end = Math.min(total, start + visible);
  // Bỏ qua nếu cửa sổ không đổi (tránh render thừa khi cuộn nhẹ)
  if (!force && start === _vt.lastStart && end === _vt.lastEnd) return;
  _vt.lastStart = start; _vt.lastEnd = end;

  const topH = start * VT_ROW_H;
  const botH = Math.max(0, (total - end) * VT_ROW_H);

  // Dùng DocumentFragment + 1 lần ghi innerHTML (batch DOM)
  let html = `<tr class="vspacer" aria-hidden="true"><td colspan="15" style="height:${topH}px"></td></tr>`;
  for (let i = start; i < end; i++) html += _rowHtml(list[i]);
  html += `<tr class="vspacer" aria-hidden="true"><td colspan="15" style="height:${botH}px"></td></tr>`;
  tbody.innerHTML = html;
  reapplyColVisibility();
}

// ═══════════════════════════════════════════════════════
//  SCHEDULE VIEWS
// ═══════════════════════════════════════════════════════
function schedNav(dir) {
  if(dir===0) { schedOffset=0; _schedOpenDay=_ymd(new Date()); }
  else { schedOffset+=dir; _schedOpenDay=null; }
  renderScheduleTab();
}

// CS chịu trách nhiệm của 1 lịch = CS CHĂM SÓC của khách (careData.cs → careCS).
// Lịch tự đặt tay không xác định được CS chăm sóc thì mới dùng người tạo (owner).
function _schedResponsibleCS(it) {
  const care = (typeof careData !== 'undefined' && careData[it.phone]) || {};
  if (care.cs) return care.cs;
  const c = _customerByPhone(it.phone);
  if (c && (c.careCS || c.cs)) return c.careCS || c.cs;
  return it.owner || it.ownerUser || '';
}
function _schedCsFilter(it, _preList) {
  // Đọc filter từ DOM (currentCS không bao giờ được cập nhật). _preList: nơi gọi đã đọc sẵn 1 lần cho cả vòng lặp.
  let filterList = _preList ? _preList.slice() : _csFilterList();
  // Khi đăng nhập role=cs mà chưa chọn filter → tự dùng (các) tên CS đăng nhập
  if (!filterList.length && typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'cs') {
    filterList = (currentUser.names && currentUser.names.length) ? currentUser.names.slice() : (currentUser.name ? [currentUser.name] : []);
  }
  if (!filterList.length) return true;
  // Lọc THEO CS CHĂM SÓC của khách (không theo người tạo lịch) — multi: khớp BẤT KỲ tên nào
  // Tách theo dấu phẩy đề phòng careCS bị gõ gộp "A, B" — so khớp từng tên riêng lẻ.
  const respNames = splitMulti_(_schedResponsibleCS(it), ',').map(n=>n.toLowerCase());
  return filterList.some(f => respNames.includes(f.toLowerCase()));
}
function _schedCsTag(it) {
  const name = _schedResponsibleCS(it);
  if (!name) return '';
  return `<span style="font-size:10px;color:var(--blue);font-weight:600;margin-left:4px;white-space:nowrap">${esc(name)}</span>`;
}
// Tên hiển thị: chỉ lấy CHỮ CUỐI (Nguyễn Duyên → Duyên)
function _lastWord(name){
  const w = String(name||'').trim().split(/\s+/).filter(Boolean);
  return w.length ? w[w.length-1] : (name||'');
}
// Mã ngắn cho loại lịch: CS 7/14/1th/2th · GL (gọi) · HM (mua) · SD (nhắc SP) · TB · 🎂 · TC
function _schedShortCode(it){
  switch(it.type){
    case 'goi':  return 'GL';
    case 'hen':  return 'HM';
    case 'sp':   return 'SD';
    case 'notify': return 'TB';
    case 'birthday': return '🎂';
    case 'custom': return it.customLabel ? esc(it.customLabel) : 'TC';
    case 'cs': {
      const n = String(it.note||'');
      if (/\+\s*7\s*ngày/i.test(n))  return 'CS 7';
      if (/\+\s*14\s*ngày/i.test(n)) return 'CS 14';
      if (/\+\s*1\s*tháng/i.test(n)) return 'CS 1th';
      if (/\+\s*2\s*tháng/i.test(n)) return 'CS 2th';
      return 'CS';
    }
    default: return 'CS';
  }
}
// Dòng note nhỏ về lịch hẹn (bỏ phần "· Đơn ..." cho gọn)
function _schedNoteShort(it){
  var n = String(it.note||'').trim();
  n = n.replace(/\s*·\s*Đơn.*$/i, '');       // bỏ đuôi "· Đơn 2026-..."
  n = n.replace(/\s*\(Data Đảo\)\s*/i, ' '); // bỏ nhãn nguồn cho gọn
  n = n.replace(/^CS\s*\+?\s*\d+\s*(ngày|tháng)\s*/i, ''); // bỏ phần mốc đã hiện ở mã ngắn
  return n.trim();
}
function _schedToggleDay(dayStr) {
  _schedOpenDay = (_schedOpenDay === dayStr) ? null : dayStr;
  renderScheduleTab();
}

function renderScheduleTab() {
  const _schedFl = _csFilterList();   // đọc DOM 1 lần/lượt vẽ, không đọc lại cho từng lịch hẹn
  const base = new Date(); base.setHours(0,0,0,0);
  const todayStr = _ymd(base);
  const grid = document.getElementById('sched-grid');
  const label = schedOffset===0?'Tuần này':schedOffset<0?`${Math.abs(schedOffset)} tuần trước`:`${schedOffset} tuần sau`;
  txt('sched-date-label', label);

  // Tự động mở ngày hôm nay khi mới vào (nếu chưa chọn ngày nào)
  if (_schedOpenDay === null) _schedOpenDay = todayStr;

  let html = '';
  for (let d=0; d<7; d++) {
    const day = new Date(base); day.setDate(base.getDate() + schedOffset*7 + d);
    const dayStr = _ymd(day);
    const items = schedules.filter(x => x.date===dayStr && !x.done && _schedCsFilter(x, _schedFl));
    const isToday = dayStr === todayStr;
    const isOpen = _schedOpenDay === dayStr;
    const dayName = day.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit'});

    html += `<div class="sched-day" style="border-bottom:1px solid var(--border)">
      <div class="sched-day-hdr" onclick="_schedToggleDay('${dayStr}')" style="cursor:pointer;user-select:none;${isToday?'background:var(--green-bg)':''}${isOpen?';background:var(--surface2)':''}">
        <div class="sched-day-title" style="${isToday?'color:var(--green)':''}${isOpen&&!isToday?';color:var(--text);font-weight:600':''}">${isToday?'⬤ ':''} ${dayName}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="sched-day-sub" style="${items.length?'color:var(--blue);font-weight:600':''}${isToday?';color:var(--green)':''}">${items.length} lịch</div>
          <span style="font-size:11px;color:var(--hint);transition:transform .15s;display:inline-block;transform:rotate(${isOpen?'90':'0'}deg)">▶</span>
        </div>
      </div>`;

    if (isOpen) {
      if (!items.length) {
        html += `<div style="padding:12px 16px;color:var(--hint);font-size:12px;text-align:center">Không có lịch hẹn trong ngày này</div>`;
      } else {
        for (const it of items) {
          const c = _customerByPhone(it.phone);
          const st = SCHED_TYPES.find(x=>x.key===it.type)||SCHED_TYPES[0];
          const _nsh = _schedNoteShort(it);
          html += `<div class="sched-item" data-phone="${esc(it.phone)}" onclick="openDp(this.dataset.phone)">
            <div class="sched-dot" style="background:${st.color}"></div>
            <div class="sched-type" style="font-weight:700;color:${st.color}">${_schedShortCode(it)}</div>
            <div class="sched-name">${c?esc(_lastWord(c.name)):it.phone}</div>
            <div class="sched-phone">${it.phone}</div>
            ${_schedCsTag(it)}
            <div class="sched-note">${esc(_nsh)}</div>
            <button onclick="event.stopPropagation();markDone('${it.id}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-size:10px;cursor:pointer;color:var(--muted);white-space:nowrap;margin-left:auto">✓ Xong</button>
          </div>`;
        }
      }
    }
    html += `</div>`;
  }
  grid.innerHTML = html;
}

// Công tắc "Theo tuần | Quá hạn" trong màn Lịch chăm sóc (gộp mục menu "Quá hạn" vào "Lịch chăm sóc").
// Vẫn dùng đúng switchTab + 2 khung cũ (#tab-schedule/#tab-overdue) nên badge, markDone, phân quyền không đổi;
// chỉ giữ highlight ở "Lịch chăm sóc" để menu trái hiện đúng đang ở mục nào.
function schedSeg(which) {
  var sch = document.querySelector('[data-bar-id="tab-schedule"]'), ov = document.querySelector('[data-bar-id="tab-overdue"]');
  if (which === 'overdue') {
    switchTab('overdue', ov || sch);
    if (sch && ov) { ov.classList.remove('active'); sch.classList.add('active'); }
  } else if (sch) switchTab('schedule', sch);
}

function renderOverdueTab() {
  const today = _ymd(new Date());
  const _ovFl = _csFilterList();   // đọc DOM 1 lần, không đọc lại cho từng lịch quá hạn
  const items = schedules.filter(x => x.date < today && !x.done && _schedCsFilter(x, _ovFl)).sort((a,b)=>a.date.localeCompare(b.date));
  txt('tb-over', fmt(items.length));
  txt('s-over', fmt(items.length));
  txt('sched-over-cnt', fmt(items.length)); txt('sched-over-cnt2', fmt(items.length));
  const grid = document.getElementById('overdue-grid');
  if (!items.length) { grid.innerHTML='<div style="padding:40px;text-align:center;color:var(--hint);font-size:12px">Không có lịch quá hạn 🎉</div>'; return; }
  const byDate = {};
  for (const it of items) { if(!byDate[it.date]) byDate[it.date]=[]; byDate[it.date].push(it); }
  let html='';
  for (const [date, its] of Object.entries(byDate)) {
    html += `<div class="sched-day"><div class="sched-day-hdr" style="background:var(--red-bg)"><div class="sched-day-title" style="color:var(--red)">${fmtDate(date)}</div><div class="sched-day-sub" style="color:var(--red)">${its.length} quá hạn</div></div>`;
    for (const it of its) {
      const c = _customerByPhone(it.phone);
      const st = SCHED_TYPES.find(x=>x.key===it.type)||SCHED_TYPES[0];
      const _nsh2 = _schedNoteShort(it);
      html += `<div class="sched-item sched-overdue" data-phone="${esc(it.phone)}" onclick="openDp(this.dataset.phone)">
        <div class="sched-dot" style="background:${st.color}"></div>
        <div class="sched-type" style="font-weight:700;color:${st.color}">${_schedShortCode(it)}</div>
        <div class="sched-name">${c?esc(_lastWord(c.name)):it.phone}</div>
        <div class="sched-phone">${it.phone}</div>
        ${_schedCsTag(it)}
        <div class="sched-note">${esc(_nsh2)}</div>
        <button onclick="event.stopPropagation();markDone('${it.id}')" style="background:var(--red-bg);border:1px solid var(--red-b);border-radius:3px;padding:2px 7px;font-size:10px;cursor:pointer;color:var(--red);white-space:nowrap;margin-left:auto">✓ Xong</button>
      </div>`;
    }
    html += `</div>`;
  }
  grid.innerHTML = html;
}


// Duyen AI - content script Ver 14.18.12.7.26 (gio.phut.ngay.thang.nam xuat ban)
// v15.5: Kich ban gui hang loat doi lai thanh 1 KICH BAN GOC (CS go/sua) + 3 KICH BAN AI sinh THEM
//        (prompt bat buoc AI chi doi rat it cau chu, khong duoc doi y/van phong/the loai);
//        Them nut "⛶ Phong to" mo khung lon cho o tin nhan/kich ban/goi y AI dai, doc xong dong lai
// v15.4: Gioi han 200 khach/ngay cho gui hang loat (dem chung moi chien dich tren may nay,
//        dat moc thi tu dong tam ngung + canh bao, CS phai bam "Kich hoat lai" moi gui tiep);
//        Them "4 kich ban AI" moi chien dich (AI viet lai giu noi dung goc, CS xem/sua/duyet
//        truoc khi luu) - khi gui se tu dong luan phien qua cac kich ban da duyet
// v15.3: Tu dong cap nhat tinh trang ket ban Zalo ve Sasum khi chay chien dich
//        (Gui ket ban->Chua ket ban; Da gui/Huy yeu cau->Chua dong y; ten co CTN->Chan;
//         ten co NHD->Zalo ngung hd; khong thay gi->Da ket ban; trung trang thai cu->bo qua)
// v15.2: Dinh tuyen gui theo Nick Zalo (perPhoneNick tu CareData.nickZalos);
//        khong danh dau skipped/failed len server nua -> nick khac van gui duoc
// v15.1: Dong bo gan-tuc-thoi - tu dong poll GAS moi 6s khi panel dang mo de lay
//        thay doi tu Sasum (hoac tu Zalo AI o may khac) ma khong ghi de field CS dang sua
// v15.0: An muc "CS cham soc" & "Nick Zalo dang dung" (tu dong lay tu thanh tren, dong bo Sasum);
//        Ghi chu CS chuyen sang dang JSON [{text,user,time}] + nut "+" giong Sasum (co lich su, xoa tung muc)
// v14.7: Nick Zalo selector, Trang thai KH, reminder polling, extended ZALO_STATUSES
(function () {
  'use strict';

  let GAS_URL = '';
  let _lookupCache = {};
  let _activeTone = 'Thân thiện';
  let _currentPhone = '';
  let _chatNamePhoneMap = {}; // { 'ten hien thi doan chat (lowercase, trim)': phone } — HOC CUC BO tren may nay
  // qua nut "🔗 Liên kết đoạn chat này". Zalo hien BIET DANH da luu cho khach da ket ban (khong con
  // hien so DT) nen khong the tu tach so bang regex — phai de CS xac nhan 1 lan, sau do tu nhan dien.
  let _currentCustData = null;
  let _cfgVisible = false;
  let _chatHistory = []; // luu tin nhan khach, khong hien thi trong textarea
  let _histVisible = false;
  let _currentCS = ''; // CS dang dung, luu vao chrome.storage
  let _currentZaloNick = ''; // Nick Zalo CS dang dung, sticky
  let _zaloNickList = []; // danh sach nick tu GAS
  let _useProducts = false; // nut 'Tra cuu san pham' — mac dinh TAT (prompt nhe, khong nap kien thuc SP)
  let _lastServerCare = {}; // baseline lan tra cuu/poll gan nhat, dung de biet CS co dang sua field nao khong
  let _pollInFlight = false;
  let _carePollStarted = false;

  // ── BROADCAST (gui tin hang loat) state ──
  let _bcRunning = false;
  let _bcPaused = false;
  let _bcStopFlag = false;
  let _bcQueue = [];
  let _bcLog = [];
  // Delay giua 2 khach (giay) - de ngau nhien cho giong nguoi that, tranh bi Zalo han che
  let _bcDelayMinSec = 45;
  let _bcDelayMaxSec = 90;
  // Cu sau bao nhieu tin thi nghi dai 1 lan
  let _bcBatchPauseEvery = 15;
  let _bcBatchPauseMin = 6;
  // Co kiem tra khop Nick Zalo dang dung voi Nick phu trach cua chien dich truoc khi gui khong
  // (mac dinh TAT vi du lieu Nick Zalo theo khach/chien dich chua duoc dong bo day du)
  let _bcCheckNick = false;
  // Tu dong soan goi y AI ngay khi mo doan chat da nhan dien duoc SDT (khong can bam
  // Lay TN / Tao goi y thu cong) — mac dinh TAT, CS tu bat trong Cai dat neu muon.
  let _autoAiReply = false;
  let _autoAiLastPhone = ''; // tranh soan lap lai nhieu lan cho cung 1 doan chat dang mo
  let _autoAiPerPhone = {}; // {[phone]: true/false} — CS bat/tat rieng cho tung khach, ghi de cai dat chung
  // Bo loc + an/hien danh sach chien dich
  let _bcSearch = '';
  let _bcDateFrom = '';
  let _bcDateTo = '';
  let _bcHidden = {};        // {campId: true} — luu rieng tung may (chrome.storage)
  let _bcActive = {};        // {campId: true} — KICH HOAT rieng tung may: ai bat thi may do moi chay duoc
  let _bcShowHidden = false; // dang xem danh sach da an?
  let _bcRunningCampId = ''; // chien dich dang chay (nut ⏸/⏹ hien theo tung the)

  // ── GIOI HAN 200 KHACH/NGAY (rieng tung may, CS tu kich hoat lai neu muon gui tiep) ──
  const BC_DAILY_LIMIT = 200;
  let _bcDailyDate = '';     // 'YYYY-MM-DD' cua lan dem gan nhat
  let _bcDailyCount = 0;     // so khach da gui THANH CONG hom nay (tinh chung moi chien dich, tren may nay)
  let _bcDailyUnlocked = false; // CS da bam "Kich hoat lai" de vuot moc 200 hom nay chua

  // ── 4 KICH BAN AI (moi campId co the co toi 4 ban tin da CS duyet, gui luan phien) ──
  let _bcVariants = {};      // {campId: [text, ...]} — da CS duyet & luu, luu rieng tung may
  let _bcVariantOpenId = ''; // campId dang mo khung soan kich ban (chi 1 the mo cung luc)
  let _bcVariantDraft = {};  // {campId: [text,...]} — 4 ban AI vua sinh, CHUA luu

  const POLL_INTERVAL_MS = 6000; // dong bo gan-tuc-thoi: kiem tra du lieu moi moi 6 giay khi panel dang mo

  const LOOKUP_TTL = 5 * 60 * 1000;
  const CARE_STATUSES = [
    'Chưa liên hệ','Chưa sử dụng','Hẹn gọi lại sau','Đang sd','Đang tạm ngưng',
    'Knm/Máy bận','Cúp ngang','Thuê bao','Phân vân/Tiềm năng','Chốt',
    'Kcnc/Không hiệu quả','Đặt hộ/Sai số','Bầu'
  ];
  const ZALO_STATUSES = ['','Đã kết bạn','Chưa kết bạn','Chưa đồng ý','Không nhận tn lạ','Chặn','Hủy kết bạn','Không tìm thấy zl','ZL NHD/K có','Zalo ngừng hd'];
  const CUST_STATUS_OPTS = [
  '','1. Không thể kết nối',
  '2.1 Không hiệu quả','2.2 Hiệu quả','2.3 Chưa rõ tác dụng',
  '3. Chưa dùng',
  '4.1 Không hiệu quả','4.2 Đã có kết quả','4.3 Đã đổi sang sản phẩm khác',
  '5. Đang tạm dừng','6. Nhận hộ / Sai số','7. Ngang Cúp','8. Từ chối'
];
  let CS_NAMES = ['','duyenht','thaomt','dieptn','vanntt']; // fallback, se load tu GAS
  let CARE_STATUS_TREE = null; // cay Tinh trang CS load tu GAS (dong bo voi appweb)

  // ── BUILD PANEL ──
  function buildPanel() {
    if (document.getElementById('ome-zai-panel')) return;

    const toggle = document.createElement('button');
    toggle.id = 'ome-zai-toggle'; toggle.title = 'Duyên AI'; toggle.textContent = '🤖 AI';
    toggle.addEventListener('click', togglePanel);
    document.body.appendChild(toggle);

    const panel = document.createElement('div');
    panel.id = 'ome-zai-panel';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'zai-hdr';
    hdr.innerHTML = `<div style="flex:1"><div class="zai-hdr-title">🤖 Duyên AI <span style="font-size:9px;font-weight:600;opacity:.85">Ver 14.06.12.7.26</span></div><div class="zai-hdr-sub">Tra cứu & gợi ý phản hồi khách</div></div>`;
    const cfgBtn = document.createElement('button');
    cfgBtn.className = 'zai-cfg-btn'; cfgBtn.id = 'zai-cfg-toggle'; cfgBtn.title = 'Cài đặt'; cfgBtn.textContent = '⚙';
    hdr.appendChild(cfgBtn); panel.appendChild(hdr);

    // Config
    const cfg = document.createElement('div');
    cfg.className = 'zai-cfg'; cfg.id = 'zai-cfg'; cfg.style.display = 'none';
    addEl(cfg, 'label', {textContent:'URL Web App GAS (appweb Sasum)'});
    const inpGas = addEl(cfg, 'input', {id:'zai-gas-url', type:'text', placeholder:'https://script.google.com/macros/s/...'});
    addEl(cfg, 'label', {textContent:'🔑 Groq API Key (chính — lưu 1 lần dùng chung cả team)'});
    addEl(cfg, 'input', {id:'zai-gemini-key', type:'text', placeholder:'gsk_... (console.groq.com) — để trống nếu giữ key cũ'});
    addEl(cfg, 'label', {textContent:'🔁 Cerebras API Key (dự phòng 1 — cloud.cerebras.ai)'});
    addEl(cfg, 'input', {id:'zai-cerebras-key', type:'text', placeholder:'csk-... — để trống nếu giữ key cũ'});
    addEl(cfg, 'label', {textContent:'🔁 Gemini API Key (dự phòng 2 — aistudio.google.com/apikey)'});
    addEl(cfg, 'input', {id:'zai-gemini-api-key', type:'text', placeholder:'AIza... — để trống nếu giữ key cũ'});
    addEl(cfg, 'div', {style:'font-size:10px;color:#9ca3af;margin:2px 0 6px', textContent:'AI tự chuyển sang key dự phòng khi Groq hết lượt (lỗi 429). Nên nhập cả 3 để không bao giờ đứng.'});
    addEl(cfg, 'label', {textContent:'📄 Link Google Sheet chi tiết sản phẩm/thành phần (tuỳ chọn, dùng chung cả team)'});
    const inpProdSheet = addEl(cfg, 'input', {id:'zai-product-sheet-url', type:'text', placeholder:'https://docs.google.com/spreadsheets/d/...'});
    addEl(cfg, 'div', {style:'font-size:10px;color:#9ca3af;margin:2px 0 6px', textContent:'Hỗ trợ nhiều tab (mỗi tab 1 hãng), dòng 1 mỗi tab là tiêu đề cột, cột đầu là tên sản phẩm. Sheet phải chia sẻ "Bất kỳ ai có liên kết – Xem" hoặc chia sẻ cho tài khoản chạy GAS. AI sẽ tự tìm đúng vài sản phẩm khớp với câu hỏi/ngữ cảnh (không nhét cả sheet) để tư vấn chính xác.'});
    const autoAiRow = addEl(cfg, 'label', {style:'display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;font-weight:400;'});
    const autoAiChk = addEl(autoAiRow, 'input', {type:'checkbox', id:'zai-auto-ai-chk'});
    addEl(autoAiRow, 'span', {textContent:'⚡ Tự động soạn 3 câu mở đầu khi mở đoạn chat khách (đỡ phải bấm Lấy TN / Tạo gợi ý)'});
    const saveBtn = addEl(cfg, 'button', {className:'zai-cfg-save', id:'zai-cfg-save', textContent:'💾 Lưu cài đặt'});
    addEl(cfg, 'div', {className:'zai-cfg-hint', textContent:'Key Groq được lưu vào Google Sheets, dùng chung cho cả team.'});
    panel.appendChild(cfg);

    // CS sticky bar
    const csBar = document.createElement('div');
    csBar.id = 'zai-cs-bar';
    csBar.style.cssText = 'background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:7px 14px;font-size:12px;';
    const csRow = document.createElement('div');
    csRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    csRow.innerHTML = '<span style="color:#166534;font-weight:700;white-space:nowrap">👤 CS:</span>';
    const csBarSel = document.createElement('select');
    csBarSel.id = 'zai-cs-bar-sel';
    csBarSel.style.cssText = 'flex:1;font-size:12px;padding:3px 6px;border:1px solid #86efac;border-radius:6px;background:#fff;color:#166534;font-weight:600;';
    ['','duyenht','dieptn','thaomt','vanntt'].forEach(s => {
      const o = document.createElement('option'); o.value=s; o.textContent=s||'-- Chọn CS --'; csBarSel.appendChild(o);
    });
    csRow.appendChild(csBarSel);
    const csBarHint = document.createElement('span');
    csBarHint.id = 'zai-cs-bar-hint';
    csBarHint.style.cssText = 'font-size:10px;color:#15803d;';
    csRow.appendChild(csBarHint);
    csBar.appendChild(csRow);
    const nzRow = document.createElement('div');
    nzRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:5px;border-top:1px solid #bbf7d0;padding-top:5px;';
    nzRow.innerHTML = '<span style="color:#166534;font-weight:700;white-space:nowrap;font-size:12px">💬 Nick:</span>';
    const nzSel = document.createElement('select');
    nzSel.id = 'zai-nz-sel';
    nzSel.style.cssText = 'flex:1;font-size:12px;padding:3px 6px;border:1px solid #86efac;border-radius:6px;background:#fff;color:#166534;';
    const nzAddBtn = document.createElement('button');
    nzAddBtn.id = 'zai-nz-add';
    nzAddBtn.textContent = '＋';
    nzAddBtn.title = 'Thêm nick mới';
    nzAddBtn.style.cssText = 'background:#15803d;color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:13px;cursor:pointer;';
    nzRow.appendChild(nzSel);
    nzRow.appendChild(nzAddBtn);
    csBar.appendChild(nzRow);
    panel.appendChild(csBar);

    // ── BROADCAST SECTION (gui tin hang loat) ──
    const bcWrap = document.createElement('div');
    bcWrap.id = 'zai-bc-wrap';
    bcWrap.style.cssText = 'border-bottom:2px solid #bbf7d0;background:#f0fdf4;flex-shrink:0;';
    const bcHdr = document.createElement('div');
    bcHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 14px;cursor:pointer;';
    bcHdr.innerHTML = '<span style="font-weight:700;color:#15803d;font-size:12px">📢 Gửi hàng loạt</span><span id="zai-bc-toggle" style="color:#15803d;font-size:11px">▼ mở</span>';
    const bcBody = document.createElement('div');
    bcBody.id = 'zai-bc-body';
    bcBody.style.cssText = 'display:none;padding:0 14px 10px;';
    bcHdr.addEventListener('click', () => {
      const hidden = bcBody.style.display === 'none';
      bcBody.style.display = hidden ? 'block' : 'none';
      document.getElementById('zai-bc-toggle').textContent = hidden ? '▲ thu gọn' : '▼ mở';
      if (hidden) loadBroadcastQueue_();
    });
    bcWrap.appendChild(bcHdr);
    bcWrap.appendChild(bcBody);
    panel.appendChild(bcWrap);

    // ── QUET DANH BA ZALO (du phong khi khach chua co don hang trong Sasum) ──
    const zsWrap = document.createElement('div');
    zsWrap.id = 'zai-zs-wrap';
    zsWrap.style.cssText = 'border-bottom:2px solid #e5e7eb;background:#f9fafb;flex-shrink:0;';
    const zsHdr = document.createElement('div');
    zsHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 14px;cursor:pointer;';
    zsHdr.innerHTML = '<span style="font-weight:700;color:#374151;font-size:12px">🔍 Quét trạng thái kết bạn Zalo (dự phòng)</span><span id="zai-zs-toggle" style="color:#374151;font-size:11px">▼ mở</span>';
    const zsBody = document.createElement('div');
    zsBody.id = 'zai-zs-body';
    zsBody.style.cssText = 'display:none;padding:8px 14px 10px;';
    zsBody.innerHTML =
      '<div style="font-size:10px;color:#6b7280;margin-bottom:6px">' +
      'Quét các số điện thoại đang thấy trên màn hình (danh bạ/tin nhắn Zalo) và tự đoán trạng thái ' +
      'kết bạn tương ứng (Đã kết bạn / Chưa kết bạn / Chặn / Zalo ngừng hd...). ' +
      'Bạn xem lại và sửa trạng thái nếu cần trước khi đồng bộ về Sasum — nick Zalo đang chọn ở trên (mục 💬 Nick) ' +
      'sẽ được ghi kèm vào danh sách nick của từng khách.</div>' +
      '<button class="zai-btn zai-btn-secondary zai-btn-sm" id="zai-zs-scan-btn">🔍 Quét màn hình hiện tại</button>' +
      '<div id="zai-zs-preview" style="margin-top:8px"></div>';
    zsHdr.addEventListener('click', () => {
      const hidden = zsBody.style.display === 'none';
      zsBody.style.display = hidden ? 'block' : 'none';
      document.getElementById('zai-zs-toggle').textContent = hidden ? '▲ thu gọn' : '▼ mở';
    });
    zsWrap.appendChild(zsHdr);
    zsWrap.appendChild(zsBody);
    panel.appendChild(zsWrap);
    zsBody.querySelector('#zai-zs-scan-btn').addEventListener('click', () => {
      renderZsPreview_(scanZaloFriendStatus_());
    });

    // Body
    const body = document.createElement('div');
    body.className = 'zai-body'; body.id = 'zai-body';

    // ── 1. PHONE ──
    addEl(body, 'div', {className:'zai-section-label', textContent:'Số điện thoại khách'});
    const phoneRow = addEl(body, 'div', {className:'zai-phone-row'});
    addEl(phoneRow, 'input', {id:'zai-phone-input', type:'tel', placeholder:'0901234567'});
    addEl(phoneRow, 'button', {className:'zai-btn zai-btn-primary zai-btn-sm', id:'zai-lookup-btn', textContent:'Tra cứu'});
    addEl(body, 'div', {id:'zai-auto-hint', style:'font-size:10px;color:#00b14f;margin-top:3px'});
    const perAutoRow = addEl(body, 'label', {id:'zai-per-auto-row', style:'display:none;align-items:center;gap:6px;margin-top:5px;font-size:11px;color:#374151;cursor:pointer;'});
    const perAutoChk = addEl(perAutoRow, 'input', {type:'checkbox', id:'zai-per-auto-chk'});
    addEl(perAutoRow, 'span', {textContent:'⚡ Tự động soạn câu mở đầu cho khách này'});

    body.appendChild(Object.assign(document.createElement('hr'), {className:'zai-div'}));

    // ── 2. AI SECTION (len tren) ──
    const aiWrap = addEl(body, 'div', {});
    const tonesDiv = addEl(aiWrap, 'div', {className:'zai-tones', style:'margin-bottom:8px'});
    ['Thân thiện','Chuyên nghiệp','Ngắn gọn','Nhiệt tình'].forEach((t,i) => {
      addEl(tonesDiv, 'button', {className:'zai-tone'+(i===0?' active':''), dataset:{tone:t}, textContent:t});
    });

    addEl(aiWrap, 'button', {className:'zai-btn zai-btn-secondary', id:'zai-open-btn',
      textContent:'💬 Tạo 3 câu mở đầu đa dạng (mua hàng + chat)', style:'width:100%;margin-bottom:8px'});

    // Grab row
    const msgHdr = addEl(aiWrap, 'div', {style:'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px'});
    addEl(msgHdr, 'div', {className:'zai-section-label', style:'margin:0', textContent:'Tin nhắn khách'});
    const msgHdrBtns = addEl(msgHdr, 'div', {style:'display:flex;gap:4px'});
    addEl(msgHdrBtns, 'button', {className:'zai-btn zai-btn-ghost zai-btn-sm', id:'zai-grab-btn',
      textContent:'📥 Lấy TN', title:'Tự động lấy 100 tin nhắn gần nhất của khách'});
    const msgZoomBtn = addEl(msgHdrBtns, 'button', {className:'zai-btn zai-btn-ghost zai-btn-sm',
      textContent:'⛶', title:'Phóng to để xem/sửa cho dễ'});

    // History status (hien thi sau khi grab, co link xem)
    const histStatus = addEl(aiWrap, 'div', {id:'zai-hist-status', style:'font-size:11px;color:#6b7280;margin-bottom:4px;display:none'});

    // Textarea (an mac dinh, chi hien khi bam "Xem")
    const msgTa = addEl(aiWrap, 'textarea', {className:'zai-msg-area', id:'zai-msg',
      placeholder:'Dán thủ công nếu cần...'});
    msgTa.style.display = 'none';
    msgZoomBtn.addEventListener('click', () => openZoomModal_(msgTa, {title:'Tin nhắn khách'}));

    // Nguyen canh input
    addEl(aiWrap, 'div', {style:'margin-top:5px;font-size:11px;color:#6b7280', textContent:'Ngữ cảnh / Sản phẩm (tuỳ chọn)'});
    addEl(aiWrap, 'input', {className:'zai-ctx-input', id:'zai-ctx', placeholder:'VD: khách hỏi về giá, muốn mua thêm...'});
    // Nut bat/tat TRA CUU SAN PHAM: chi khi bat, AI moi nap kien thuc san pham (Google Sheet) — tra loi ky ve thanh phan/cong dung
    const prodRow = addEl(aiWrap, 'label', {style:'display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:#374151;cursor:pointer'});
    const prodChk = addEl(prodRow, 'input', {type:'checkbox', id:'zai-use-products'});
    addEl(prodRow, 'span', {innerHTML:'🔍 <b>Tra cứu sản phẩm</b> (nạp dữ liệu Google Sheet để tư vấn kỹ thành phần/công dụng — dùng khi cần)'});
    prodChk.addEventListener('change', () => { _useProducts = prodChk.checked; });
    addEl(aiWrap, 'button', {className:'zai-btn zai-btn-primary', id:'zai-gen-btn',
      textContent:'✨ Tạo gợi ý phản hồi', style:'width:100%;margin-top:8px'});

    addEl(body, 'div', {id:'zai-sug-area'});
    addEl(body, 'div', {className:'zai-error', id:'zai-error', style:'display:none'});

    body.appendChild(Object.assign(document.createElement('hr'), {className:'zai-div'}));

    // ── 3. UPDATE SECTION (tren) ──
    const upd = addEl(body, 'div', {className:'zai-update-section', id:'zai-update-section'});
    upd.style.display = 'block'; // hien san ngay khi mo panel (khong cho tra cuu)
    addEl(upd, 'div', {className:'zai-section-label', style:'margin-bottom:8px', textContent:'📋 Cập nhật thông tin CS'});

    const row1 = addEl(upd, 'div', {className:'zai-field-row'});
    const col1 = addEl(row1, 'div', {className:'zai-field-col'});
    addEl(col1, 'label', {textContent:'Tình trạng CS'});
    const statusSel = addEl(col1, 'select', {id:'zai-status-sel'});
    addEl(statusSel, 'option', {value:'', textContent:'— Chọn —'});
    CARE_STATUSES.forEach(s => addEl(statusSel, 'option', {value:s, textContent:s}));

    const col2 = addEl(row1, 'div', {className:'zai-field-col'});
    addEl(col2, 'label', {textContent:'Kết bạn Zalo'});
    const zaloSelRow = addEl(col2, 'div', {style:'display:flex;gap:4px;align-items:center;'});
    const zaloSel = addEl(zaloSelRow, 'select', {id:'zai-zalo-sel', style:'flex:1;'});
    ZALO_STATUSES.forEach(s => addEl(zaloSel, 'option', {value:s, textContent:s||'— Chọn —'}));
    const linkChatBtn = addEl(zaloSelRow, 'button', {className:'zai-btn zai-btn-ghost zai-btn-sm', id:'zai-link-chat-btn', type:'button', textContent:'🔗', title:'Liên kết đoạn chat Zalo ĐANG MỞ với khách này — làm 1 lần để lần sau tự nhận diện dù Zalo hiện biệt danh thay vì SĐT'});

    // CS chăm sóc & Nick Zalo CS đang dùng: KHÔNG hiển thị nữa,
    // tự động = CS / Nick đã chọn ở thanh trên cùng (đồng bộ 2 chiều với Sasum)
    addEl(upd, 'input', {id:'zai-cs-sel', type:'hidden'});
    addEl(upd, 'input', {id:'zai-nz-form-sel', type:'hidden'});

    addEl(upd, 'label', {textContent:'Trạng thái KH'});
    const khStatusSel = addEl(upd, 'select', {id:'zai-kh-status-sel'});
    CUST_STATUS_OPTS.forEach(s => addEl(khStatusSel, 'option', {value:s, textContent:s||'— Chọn —'}));

    const row2 = addEl(upd, 'div', {className:'zai-field-row'});
    const col3 = addEl(row2, 'div', {className:'zai-field-col'});
    addEl(col3, 'label', {textContent:'Lịch hẹn'});
    addEl(col3, 'input', {id:'zai-hen-date', type:'date'});
    const col4 = addEl(row2, 'div', {className:'zai-field-col'});
    addEl(col4, 'label', {textContent:'Ghi chú hẹn'});
    addEl(col4, 'input', {id:'zai-hen-note', type:'text', placeholder:'Hẹn gì...'});
    const col5 = addEl(row2, 'div', {className:'zai-field-col'});
    addEl(col5, 'label', {textContent:'🎂 Sinh nhật'});
    addEl(col5, 'input', {id:'zai-birthday', type:'date'});

    addEl(upd, 'label', {textContent:'Ghi chú CS'});
    const noteWrap = addEl(upd, 'div', {className:'zai-note-wrap'});
    const noteRow  = addEl(noteWrap, 'div', {className:'zai-note-row'});
    addEl(noteRow, 'textarea', {id:'zai-note-new', placeholder:'Thêm ghi chú mới...', rows:2});
    addEl(noteRow, 'button', {className:'zai-btn zai-btn-primary zai-btn-sm', id:'zai-note-add-btn', type:'button', textContent:'+', title:'Thêm ghi chú (Ctrl+Enter)'});
    addEl(noteWrap, 'div', {id:'zai-note-history', className:'zai-note-history'});
    addEl(upd, 'input', {id:'zai-note-raw', type:'hidden'});

    const saveRow = addEl(upd, 'div', {className:'zai-save-row'});
    addEl(saveRow, 'button', {className:'zai-btn zai-btn-primary zai-btn-sm', id:'zai-save-btn', textContent:'💾 Lưu về GSheet'});
    addEl(saveRow, 'span', {className:'zai-save-status', id:'zai-save-status'});

    // ── 4. CUSTOMER CARD (duoi cung) ──
    addEl(body, 'div', {id:'zai-cust-area'});

    panel.appendChild(body);
    document.body.appendChild(panel);

    // ── EVENTS ──
    cfgBtn.addEventListener('click', () => { _cfgVisible = !_cfgVisible; cfg.style.display = _cfgVisible ? 'block' : 'none'; });
    saveBtn.addEventListener('click', saveConfig);
    document.getElementById('zai-lookup-btn').addEventListener('click', doLookup);
    document.getElementById('zai-save-btn').addEventListener('click', doSaveStatus);
    linkChatBtn.addEventListener('click', () => {
      const name = getCurrentChatName();
      if (!name) { showError('Không đọc được tên đoạn chat Zalo đang mở.'); return; }
      if (!_currentCustData || !_currentCustData.phone) { showError('Chưa tra cứu khách nào để liên kết.'); return; }
      learnChatNameForPhone_(name, _currentCustData.phone);
      showMsg('zai-save-status', '🔗 Đã liên kết "' + name.trim() + '" với ' + _currentCustData.phone + ' — lần sau tự nhận diện.', 3000);
    });
    document.getElementById('zai-open-btn').addEventListener('click', doGenerateOpener);
    document.getElementById('zai-grab-btn').addEventListener('click', doGrabMessage);
    document.getElementById('zai-gen-btn').addEventListener('click', doGenerate);
    document.getElementById('zai-note-add-btn').addEventListener('click', addNoteEntry_);
    document.getElementById('zai-note-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNoteEntry_(); }
    });
    tonesDiv.addEventListener('click', (e) => {
      const tb = e.target.closest('.zai-tone'); if (!tb) return;
      tonesDiv.querySelectorAll('.zai-tone').forEach(b => b.classList.remove('active'));
      tb.classList.add('active'); _activeTone = tb.dataset.tone;
    });
    chrome.storage.local.get(['ome_bc_hidden','ome_bc_active','ome_bc_daily','ome_bc_variants'], (res) => {
      _bcHidden = res.ome_bc_hidden || {};
      _bcActive = res.ome_bc_active || {};
      const daily = res.ome_bc_daily || {};
      _bcDailyDate = daily.date || '';
      _bcDailyCount = daily.count || 0;
      _bcDailyUnlocked = !!daily.unlocked;
      _bcVariants = res.ome_bc_variants || {};
      _bcCheckDailyReset_();
    });
    chrome.storage.local.get(['ome_gas_url','ome_current_cs','ome_current_nz','ome_auto_ai_reply','ome_auto_ai_per_phone'], (res) => {
      GAS_URL = res.ome_gas_url || '';
      if (GAS_URL) { inpGas.value = GAS_URL; loadCSNames_(); loadNickZaloList_(); loadCareStatusTree_(); loadProductSheetUrl_(); }
      loadChatNamePhoneMap_();
      if (!GAS_URL) { _cfgVisible = true; cfg.style.display = 'block'; }
      _currentCS = res.ome_current_cs || '';
      if (_currentCS) {
        csBarSel.value = _currentCS;
        csBarHint.textContent = 'tự động áp dụng';
      }
      _currentZaloNick = res.ome_current_nz || '';
      _autoAiReply = !!res.ome_auto_ai_reply;
      autoAiChk.checked = _autoAiReply;
      _autoAiPerPhone = res.ome_auto_ai_per_phone || {};
      startReminderPoll_();
    });
    autoAiChk.addEventListener('change', () => {
      _autoAiReply = autoAiChk.checked;
      chrome.storage.local.set({ ome_auto_ai_reply: _autoAiReply });
    });
    nzSel.addEventListener('change', () => {
      _currentZaloNick = nzSel.value;
      chrome.storage.local.set({ ome_current_nz: _currentZaloNick });
      const nzF = document.getElementById('zai-nz-form-sel');
      if (nzF) nzF.value = _currentZaloNick;
    });
    nzAddBtn.addEventListener('click', async () => {
      const nick = (prompt('Nhập nick Zalo mới:') || '').trim();
      if (!nick) return;
      if (GAS_URL) {
        try {
          // Uu tien addZaloNick: server tu MERGE vao danh sach chung -> khong ghi de mat nick cu
          const r = await fetch(GAS_URL, {method:'POST', body:JSON.stringify({action:'addZaloNick', nick}), headers:{'Content-Type':'text/plain'}});
          const d = await r.json();
          if (d && d.error) {
            // GAS cu chua co addZaloNick -> fallback: tai list MOI NHAT tu server, merge roi luu
            await loadNickZaloList_();
            if (!_zaloNickList.includes(nick)) _zaloNickList.push(nick);
            await fetch(GAS_URL, {method:'POST', body:JSON.stringify({action:'setSetting',key:'nickZaloList',value:JSON.stringify(_zaloNickList)}), headers:{'Content-Type':'text/plain'}});
          }
        } catch(e) {}
      }
      await loadNickZaloList_();
      if (!_zaloNickList.includes(nick)) _zaloNickList.push(nick);
      const nzSelEl = document.getElementById('zai-nz-sel');
      if (nzSelEl) nzSelEl.value = nick;
      _currentZaloNick = nick;
      chrome.storage.local.set({ ome_current_nz: nick });
      const nzF = document.getElementById('zai-nz-form-sel');
      if (nzF) nzF.value = nick;
    });
    csBarSel.addEventListener('change', () => {
      _currentCS = csBarSel.value;
      chrome.storage.local.set({ ome_current_cs: _currentCS });
      csBarHint.textContent = _currentCS ? 'đã lưu' : '';
      setTimeout(() => { csBarHint.textContent = _currentCS ? 'tự động áp dụng' : ''; }, 1500);
      // Cap nhat dropdown CS trong form neu dang mo
      const csSel = document.getElementById('zai-cs-sel');
      if (csSel) csSel.value = _currentCS;
    });
    perAutoChk.addEventListener('change', () => {
      const phone = _currentCustData && _currentCustData.phone;
      if (!phone) return;
      _autoAiPerPhone[phone] = perAutoChk.checked;
      chrome.storage.local.set({ ome_auto_ai_per_phone: _autoAiPerPhone });
    });
  }

  function addEl(parent, tag, props) {
    const el = document.createElement(tag);
    if (props.dataset) { Object.assign(el.dataset, props.dataset); delete props.dataset; }
    if (props.style && typeof props.style === 'string') { el.style.cssText = props.style; delete props.style; }
    Object.assign(el, props);
    parent.appendChild(el);
    return el;
  }

  function togglePanel() {
    const panel = document.getElementById('ome-zai-panel');
    const btn   = document.getElementById('ome-zai-toggle');
    if (!panel) return;
    panel.classList.toggle('open'); btn.classList.toggle('shifted');
  }

  async function saveConfig() {
    const gasEl = document.getElementById('zai-gas-url');
    GAS_URL = gasEl ? gasEl.value.trim() : '';
    if (!GAS_URL) { showError('Vui lòng nhập URL GAS.'); return; }
    chrome.storage.local.set({ ome_gas_url: GAS_URL });
    // Luu tung API key (CHI ghi khi co nhap -> tranh xoa key da luu cua team)
    const _saveKey = async (settingKey, elId) => {
      const el = document.getElementById(elId);
      const v = el ? el.value.trim() : '';
      if (!v) return true;
      try {
        const r = await fetch(GAS_URL, { method:'POST', body:JSON.stringify({action:'setSetting',key:settingKey,value:v}), headers:{'Content-Type':'text/plain'} });
        const d = await r.json();
        if (d.ok) { if (el) el.value=''; return true; }
        showError('Lỗi lưu ' + settingKey + ': ' + JSON.stringify(d)); return false;
      } catch(e) { showError('Lỗi kết nối GAS: '+e.message); return false; }
    };
    const keyEl = document.getElementById('zai-gemini-key');
    const key = keyEl ? keyEl.value.trim() : '';
    if (!(await _saveKey('apiGroq', 'zai-gemini-key'))) return;
    if (!(await _saveKey('apiCerebras', 'zai-cerebras-key'))) return;
    if (!(await _saveKey('apiGemini', 'zai-gemini-api-key'))) return;
    if (key) showMsg('zai-save-status','✓ Đã lưu API key!',3000);
    const prodSheetEl = document.getElementById('zai-product-sheet-url');
    const prodSheetUrl = prodSheetEl ? prodSheetEl.value.trim() : '';
    try {
      await fetch(GAS_URL, { method:'POST', body:JSON.stringify({action:'setSetting',key:'productSheetUrl',value:prodSheetUrl}), headers:{'Content-Type':'text/plain'} });
    } catch(e) { /* khong chan luong luu chinh neu loi rieng phan nay */ }
    _cfgVisible = false;
    document.getElementById('zai-cfg').style.display = 'none';
    _lookupCache = {};
    loadCSNames_();
    loadCareStatusTree_();
    if (!key) showMsg('zai-save-status','✓ Đã lưu cài đặt',2000);
  }

  async function loadProductSheetUrl_() {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=getSetting&key=productSheetUrl', {redirect:'follow'});
      const d = await r.json();
      const el = document.getElementById('zai-product-sheet-url');
      if (el && d && d.value) el.value = d.value;
    } catch(e) {}
  }

  function normPhone(p) {
    if (!p) return '';
    let s = String(p).replace(/\D/g,'');
    if (s.startsWith('84') && s.length===11) s='0'+s.slice(2);
    if (s.length===9 && /^[3-9]/.test(s)) s='0'+s;
    return s;
  }

  function extractPhone(text) {
    if (!text) return null;
    const m = text.match(/(0[3-9]\d{8})/);
    return m ? m[1] : null;
  }
  function getCurrentChatName() {
    const sels = ['div[contenteditable][placeholder*="tin nhắn tới"]','[placeholder*="tin nhắn tới"]','[data-placeholder*="tin nhắn tới"]'];
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const ph = el.getAttribute('placeholder')||el.getAttribute('data-placeholder')||'';
          const name = ph.replace(/^.*tin nhắn tới\s*/i,'').trim();
          if (name) return name;
        }
      } catch(e){}
    }
    for (const sel of ['.chat-header__title','[class*="chat-header"] [class*="title"]','[class*="header"] h3','[class*="header"] h4']) {
      try { const el=document.querySelector(sel); if(el&&el.textContent.trim()) return el.textContent.trim(); } catch(e){}
    }
    return null;
  }
  function watchZaloChat() {
    let _last = '';
    function check() {
      const name = getCurrentChatName();
      if (!name || name === _last) return;
      _last = name;
      const phone = resolvePhoneForChatName_(name);
      if (phone && phone !== _currentPhone) {
        _currentPhone = phone;
        const inp = document.getElementById('zai-phone-input');
        if (inp) {
          inp.value = phone;
          const hint = document.getElementById('zai-auto-hint');
          if (hint) hint.textContent = '✓ Tự động: '+name.trim();
          doLookup();
          _autoSuggestForOpenChat_(phone);
        }
      }
    }
    new MutationObserver(check).observe(document.body, {childList:true, subtree:true, characterData:true});
    setInterval(check, 1500);
  }

  // Trang thai bat/tat "tu dong soan AI" hieu luc cho 1 SDT: uu tien lua chon rieng CS
  // da bam cho khach nay (checkbox trong panel), neu chua tung chon thi dung cai dat chung.
  function _effectiveAutoAi_(phone) {
    if (!phone) return _autoAiReply;
    if (Object.prototype.hasOwnProperty.call(_autoAiPerPhone, phone)) return !!_autoAiPerPhone[phone];
    return _autoAiReply;
  }

  // Hien/dong bo checkbox "Tu dong soan AI cho khach nay" theo dung SDT dang xem
  function _updatePerPhoneToggleUI_(phone) {
    const row = document.getElementById('zai-per-auto-row');
    const chk = document.getElementById('zai-per-auto-chk');
    if (!row || !chk) return;
    if (!phone) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    chk.checked = _effectiveAutoAi_(phone);
  }

  // Tu dong soan san 3 câu MỞ ĐẦU đa dạng (khong can CS bam Lay TN / Tao goi y) — muc dich
  // chinh cua AI la giup CS co cau chuyen khoi gợi khi CHU DONG bat chuyen voi khach, con
  // doan chat tiep theo CS tu nghi, chi bam nut "✨ Tạo gợi ý phản hồi" thu cong khi nao bi.
  // Vi vay o day LUON goi doGenerateOpener() (3 huong da dang), khong tu dong tra loi thay CS.
  // Doi 1 chut de: (1) doLookup() render xong _currentCustData, (2) khung chat Zalo kip
  // load tin nhan len DOM de doGrabMessage() doc duoc (chi de AI THAM KHAO, tranh trung chu de).
  function _autoSuggestForOpenChat_(phone) {
    if (_autoAiLastPhone === phone) return; // da soan cho doan chat nay roi, khong lap lai
    setTimeout(() => {
      // CS co the da chuyen sang doan chat khac trong luc cho -> bo qua, tranh soan nham
      if (_currentPhone !== phone) return;
      if (!_currentCustData || _currentCustData.phone !== phone) return;
      _updatePerPhoneToggleUI_(phone); // dam bao checkbox hien dung trang thai cua khach nay
      if (!_effectiveAutoAi_(phone)) return; // CS da tat rieng cho khach nay (hoac tat chung)
      _autoAiLastPhone = phone;
      try { doGrabMessage(); } catch(e) {}
      doGenerateOpener();
    }, 1200);
  }

  // ── GRAB TIN NHẮN KHÁCH ──

  // Lay text thuan, bo qua <img> (Zalo render emoticon thanh img)
  function getTextOnly_(el) {
    let t = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) t += node.textContent;
      else if (node.nodeType === 1 && node.tagName !== 'IMG') t += getTextOnly_(node);
    }
    return t;
  }

  function stripText_(text) {
    return text
      // Xoa timestamp noi tuyen vi du "20:23" gan sat chu
      .replace(/\d{1,2}:\d{2}/g, '')
      // Zalo text emoticon dang /-heart/ hoac /-heart (co slash cuoi hoac khong)
      .replace(/\/-[\w-]+\/?/g, '')
      // Emoticon alt text dang -heart -strong (khong co slash dau)
      .replace(/(^|\s)-[a-z][\w-]*/gi, '$1')
      // Text emoticons ASCII
      .replace(/:-?[hH]|:-?[)(DdPpOo><]|:[vV3]|=\)+|\^{2,}|>:<|:\*/g, '')
      // Unicode emoji
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const SKIP_MSG = [
    /^\d{1,2}:\d{2}$/,
    /^\d{1,3}$/,
    /^bạn bị nhỡ/i,
    /^cuộc gọi/i,
    /^gọi lại$/i,
    /^missed call/i,
    /^đã thu hồi/i,
    /^tin nhắn đã xóa/i,
  ];

  function doGrabMessage() {
    const chatArea = document.querySelector(
      '[class*="chat-content"],[class*="message-list"],[class*="conversation-content"],[class*="msg-list"],[class*="MessageBox"]'
    );
    if (!chatArea) { showError('Không tìm thấy vùng chat. Thử click vào cuộc trò chuyện trước.'); return; }

    const chatRect = chatArea.getBoundingClientRect();
    const midX = chatRect.left + chatRect.width * 0.55;

    const OWN_MARKERS = ['owner','--me','_me_','sent','outgoing'];
    let allItems = [];
    for (const sel of ['[class*="message-item"]','[class*="msg-item"]','[class*="chat-item"]','[class*="message"]']) {
      const found = [...chatArea.querySelectorAll(sel)];
      if (found.length > 2) { allItems = found; break; }
    }

    let msgs = [];
    for (const item of allItems) {
      try {
        const cls = (item.className||'').toLowerCase();
        if (OWN_MARKERS.some(m => cls.includes(m))) continue;
        const rect = item.getBoundingClientRect();
        if (rect.width > 10 && rect.left > midX) continue;
        if (['system','notify','date-','divider'].some(m => cls.includes(m))) continue;

        const textEl = item.querySelector('[class*="text"],[class*="content"],[class*="body"],[class*="message-text"]') || item;
        const raw = getTextOnly_(textEl).trim();
        if (!raw) continue;
        if (SKIP_MSG.some(p => p.test(raw))) continue;

        const clean = stripText_(raw);
        if (!clean || clean.length < 2) continue;
        msgs.push(clean);
      } catch(e) {}
    }

    const seen = new Set();
    const uniq = msgs.filter(m => { if (seen.has(m)) return false; seen.add(m); return true; });
    const last100 = uniq.slice(-100);

    const histStatus = document.getElementById('zai-hist-status');
    const msgTa = document.getElementById('zai-msg');

    if (last100.length) {
      _chatHistory = last100;
      // Dien vao textarea (an) de du phong
      if (msgTa) msgTa.value = last100.join('\n---\n');

      // Hien thi trang thai + nut xem
      if (histStatus) {
        _histVisible = false;
        if (msgTa) msgTa.style.display = 'none';
        histStatus.style.display = 'block';
        histStatus.innerHTML = `✓ Load history done: <b>${last100.length} tin</b> &nbsp;<a href="#" id="zai-hist-toggle" style="color:#00b14f;text-decoration:underline">Xem</a>`;
        document.getElementById('zai-hist-toggle').addEventListener('click', (e) => {
          e.preventDefault();
          _histVisible = !_histVisible;
          if (msgTa) msgTa.style.display = _histVisible ? 'block' : 'none';
          e.target.textContent = _histVisible ? 'Ẩn' : 'Xem';
        });
      }
    } else {
      showError('Không đọc được tin nhắn. Dán thủ công vào ô bên dưới.');
      if (histStatus) histStatus.style.display = 'none';
      if (msgTa) msgTa.style.display = 'block';
    }
  }

  // ── LOOKUP ──
  // Tự phát hiện trạng thái kết bạn Zalo của đoạn chat ĐANG MỞ và cập nhật về Sasum.
  // Chỉ chạy khi đoạn chat đang mở đúng là khách vừa tra cứu (tránh nhận nhầm số nhập tay).
  async function _syncZaloStatusForOpenChat(phone, existsInSystem) {
    if (!GAS_URL || !phone) return;
    const openPhone = resolvePhoneForChatName_(getCurrentChatName() || '');
    if (!openPhone || openPhone !== phone) return; // không phải đoạn chat của khách này
    learnChatNameForPhone_(getCurrentChatName(), phone); // ghi nho co hoi: lan sau nhan dien duoc ca khi doi ten hien thi
    await sleep_(500); // đợi DOM Zalo ổn định để đọc đúng nút "Gửi kết bạn"
    const st = detectZaloFriendStatus_();
    const zaloSel = document.getElementById('zai-zalo-sel');
    if (zaloSel) zaloSel.value = st; // hiển thị ngay trên dropdown
    if (!existsInSystem) return; // khách chưa có trong hệ thống → chỉ điền sẵn, CS tự bấm Lưu
    const care = (_currentCustData && _currentCustData.care) ||
                 (_lookupCache[phone] && _lookupCache[phone].care) || null;
    if (care && (care.zalo || '') === st) return; // đã đúng trạng thái → bỏ qua
    try {
      // FIX: KHONG dung 'saveSingle' o day nua. 'care' o tren co the la ban cache cuc bo
      // (toi da 5 phut, xem _lookupCache) — neu dung saveSingle se ghi DE TOAN BO dong
      // (status/cs/note/schedules...) bang du lieu cu trong cache, xoa mat nhung gi CS
      // vua luu tren Sasum trong luc do. Chi dung action 'syncZaloFriendStatus' — action
      // nay CHI ghi dung cot zalo/updated/nick/zaloSetBy, khong dung vao cac truong khac.
      await fetch(GAS_URL, { method:'POST', body: JSON.stringify({
        action:'syncZaloFriendStatus',
        rows:[{ phone: phone, zalo: st, scannedBy: _currentCS || '', nick: _currentZaloNick || '' }]
      }), headers:{'Content-Type':'text/plain'} });
      if (_currentCustData && _currentCustData.phone === phone) _currentCustData.care = Object.assign({}, care||{}, { zalo: st });
      if (_lookupCache[phone] && _lookupCache[phone].care) _lookupCache[phone].care.zalo = st;
      showMsg('zai-save-status', '🔗 Đã cập nhật kết bạn Zalo: ' + st, 3000);
    } catch (e) {}
  }

  // Nhu _revalidateFromServer_ nhung LUON ve lai the sau khi fetch xong (khong so sanh
  // "co thay doi hay khong"). Dung sau khi XOA don — dam bao UI cap nhat ngay, tranh
  // truong hop so sanh truot khien card van hien du lieu cu du server da xoa xong.
  async function _zaiForceRefresh_(phone) {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=lookup&phone=' + encodeURIComponent(phone) + '&_ts=' + Date.now(), {redirect:'follow'});
      const d = await r.json();
      if (d.error) { console.warn('[ZaloAI] Loi lam moi:', d.error); return; }
      const newCare   = d.care || null;
      const newOrders = (d.orders||[]).slice().sort((a,b) => parseDate_(b.date)-parseDate_(a.date));
      if (!_currentCustData || _currentCustData.phone !== phone) {
        _lookupCache[phone] = {care: newCare, orders: newOrders, ts: Date.now()};
        return;
      }
      applyPolledCare_(phone, newCare, newOrders);
    } catch (e) { console.warn('[ZaloAI] Lam moi that bai:', e); }
  }

  // Kiem tra ngam voi server (khong phu thuoc panel dang mo/thu gon nhu pollCareTick_) —
  // dung ngay sau khi hien du lieu tu cache, de bat kip thay doi Sasum vua luu ma cache
  // cuc bo (toi da 5 phut) chua het han.
  async function _revalidateFromServer_(phone) {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=lookup&phone=' + encodeURIComponent(phone) + '&_ts=' + Date.now(), {redirect:'follow'});
      const d = await r.json();
      if (d.error) return;
      const newCare   = d.care || null;
      const newOrders = (d.orders||[]).slice().sort((a,b) => parseDate_(b.date)-parseDate_(a.date));
      if (!_currentCustData || _currentCustData.phone !== phone) {
        // CS da chuyen sang khach khac trong luc cho fetch — van cap nhat cache ngam, khong dong bo UI
        _lookupCache[phone] = {care: newCare, orders: newOrders, ts: Date.now()};
        return;
      }
      const oldUpdated = _lastServerCare && _lastServerCare.updated;
      const newUpdated = newCare && newCare.updated;
      const changed = (newUpdated || '') !== (oldUpdated || '') || newOrders.length !== (_currentCustData.orders||[]).length;
      if (!changed) { _lookupCache[phone] = {care: newCare, orders: newOrders, ts: Date.now()}; return; }
      applyPolledCare_(phone, newCare, newOrders);
    } catch (e) { /* im lang, se thu lai o lan tra cuu/poll sau */ }
  }

  // Kiem tra don trung cua 1 khach (cung SDT + ngay mua + san pham — KHONG xet doanh
  // thu, de bat ca truong hop doanh thu bi lech do loi nhap lieu, VD mat 3 so 0:
  // 689 thay vi 689.000) va hoi xac nhan truoc khi xoa. Chi tac dong len khach dang
  // xem tren the (khong dung de dedupe toan bo he thong — viec do lam ben Sasum).
  async function zaiCheckDuplicates_(phone) {
    if (!GAS_URL) { alert('Chưa cấu hình Google Sheets URL.'); return; }
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=findDuplicateOrders&phone=' + encodeURIComponent(phone), {redirect:'follow'});
      const d = await r.json();
      if (!d.ok) { alert('Lỗi kiểm tra: ' + (d.error || 'không rõ')); return; }
      const groups = d.groups || [];
      if (!groups.length) { alert('Không phát hiện đơn trùng cho khách này.'); return; }
      const items = [];
      let msg = 'Phát hiện đơn trùng của khách này:\n\n';
      groups.forEach(g => {
        const dateLabel = fmtDate_(g.date) || (g.month + '/' + g.year);
        if (g.exact) {
          msg += '• ' + dateLabel + ' — ' + Number(g.rows[0].revenue||0).toLocaleString('vi-VN') + 'đ — dư ' + g.extras.length + ' đơn giống hệt (sẽ xóa dòng dư, giữ 1 dòng)\n';
        } else if (g.zeroLossPattern) {
          msg += '• ' + dateLabel + ' — CÁC DÒNG DOANH THU: ' + g.rows.map(row => Number(row.revenue||0).toLocaleString('vi-VN')+'đ').join(' / ') + '\n  ⚠ ' + g.note + '\n';
        } else {
          msg += '• ' + dateLabel + ' — CÁC DÒNG DOANH THU KHÁC NHAU: ' + g.rows.map(row => Number(row.revenue||0).toLocaleString('vi-VN')+'đ').join(' / ') + '\n  ⚠ ' + g.note + '\n  → Mở Sasum (nút 🗑️ Đơn trùng) để tự chọn đúng dòng SAI cần xóa, tránh xóa nhầm dòng đúng.\n';
        }
        g.extras.forEach(row => items.push({ sheet: row.sheet, rowIndex: row.rowIndex }));
      });
      if (!items.length) { alert(msg); return; }
      msg += '\nXóa ' + items.length + ' đơn được đề xuất ở trên? Không thể hoàn tác — hãy đọc kỹ các dòng có cảnh báo ⚠ trước khi đồng ý.';
      if (!confirm(msg)) return;
      const r2 = await fetch(GAS_URL, { method:'POST', body: JSON.stringify({ action:'deleteDuplicateOrders', items }), headers:{'Content-Type':'text/plain'} });
      const d2 = await r2.json();
      if (!d2.ok) { alert('Lỗi xóa: ' + (d2.error || 'không rõ')); return; }
      alert('✓ Đã xóa ' + d2.deleted + ' đơn trùng.');
      delete _lookupCache[phone];
      await _zaiForceRefresh_(phone);
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  }

  async function doLookup() {
    const raw = (document.getElementById('zai-phone-input').value||'').trim();
    if (!raw) { showError('Vui lòng nhập số điện thoại.'); return; }
    hideError();
    const phone = normPhone(raw);
    const area   = document.getElementById('zai-cust-area');
    const updSec = document.getElementById('zai-update-section');
    updSec.style.display = 'block'; // luon hien muc cap nhat
    _currentCustData = null;

    if (!GAS_URL) { showError('Chưa cài URL GAS. Nhấn ⚙.'); area.innerHTML=''; return; }

    const hit = _lookupCache[phone];
    if (hit && Date.now() - hit.ts < LOOKUP_TTL) {
      if (!hit.orders.length && !hit.care) { showNotFoundWithForm_(area, updSec, phone, raw); _syncZaloStatusForOpenChat(phone, false); }
      else { renderCard_(area, updSec, phone, raw, hit.care, hit.orders); _syncZaloStatusForOpenChat(phone, true); }
      // Hien ngay du lieu cache cho nhanh, nhung LUON kiem tra lai server ngam —
      // tranh truong hop Sasum vua duoc cap nhat (tu appweb hoac may khac) trong
      // luc cache con "moi" (TTL 5 phut) ma CS lai khong thay gi doi.
      _revalidateFromServer_(phone);
      return;
    }

    area.innerHTML = '<div class="zai-loading"><div class="zai-spinner"></div>Đang tra cứu...</div>';

    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(
        GAS_URL + sep + 'action=lookup&phone=' + encodeURIComponent(phone),
        {redirect:'follow'}
      );
      const d = await r.json();
      if (d.error) throw new Error(d.error);

      const orders = (d.orders||[]).slice().sort((a,b) => parseDate_(b.date)-parseDate_(a.date));
      _lookupCache[phone] = {care: d.care||null, orders, ts: Date.now()};

      if (!orders.length && !d.care) {
        showNotFoundWithForm_(area, updSec, phone, raw);
        _syncZaloStatusForOpenChat(phone, false);
      } else {
        renderCard_(area, updSec, phone, raw, d.care||null, orders);
        _syncZaloStatusForOpenChat(phone, true);
      }
    } catch(e) {
      area.innerHTML = '';
      showError('Lỗi tra cứu: ' + e.message);
      showNotFoundWithForm_(area, updSec, phone, raw);
    }
  }

  function showNotFoundWithForm_(area, updSec, phone, raw) {
    area.innerHTML = `<div class="zai-not-found">⚠️ <strong>${escHtml(raw)}</strong> chưa có trong hệ thống.<br><small>Có thể thêm mới bên dưới.</small></div>`;
    _currentCustData = {phone, name: raw, care: null, orders: []};
    _lastServerCare  = {};
    updSec.style.display = 'block';
    clearForm_();
    _updatePerPhoneToggleUI_(phone);
  }

  function clearForm_() {
    ['zai-status-sel','zai-zalo-sel','zai-hen-date','zai-hen-note','zai-note-new']
      .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const csSel = document.getElementById('zai-cs-sel');
    if (csSel) csSel.value = _currentCS || '';
    const nzF = document.getElementById('zai-nz-form-sel');
    if (nzF) nzF.value = _currentZaloNick || '';
    const rawEl = document.getElementById('zai-note-raw');
    if (rawEl) rawEl.value = '';
    renderNoteHistory_('');
  }

  // Phat hien cac dong "mat 3 so 0" (VD 708 thay vi 708.000) trong danh sach don cua 1
  // khach: gom nhom theo ngay+san pham+chi tiet san pham, neu 2 dong lech nhau DUNG 1000
  // lan thi danh dau dong GIA TRI NHO HON (dong loi) de hien nut × xoa nhanh ben canh so
  // tien. Can sheet+rowIndex (server tra ve tu readOrdersByPhone_) de xoa dung dong.
  function _dupRevenueFlags_(orders) {
    const groups = {};
    orders.forEach(o => {
      if (!o.sheet || !o.rowIndex) return;
      const key = String(o.date) + '|' + String(o.product||'').trim().toLowerCase() + '|' + String(o.productDetail||'').trim().toLowerCase();
      (groups[key] = groups[key] || []).push(o);
    });
    const flags = {};
    Object.values(groups).forEach(g => {
      if (g.length < 2) return;
      g.forEach(a => {
        const ra = Number(a.revenue) || 0;
        g.forEach(b => {
          if (a === b) return;
          const rb = Number(b.revenue) || 0;
          if (ra > 0 && rb > 0 && ra !== rb && rb === ra * 1000) {
            flags[a.sheet + '|' + a.rowIndex] = { correct: rb }; // a la dong loi (nho hon), b la dong dung
          }
        });
      });
    });
    return flags;
  }

  // Ve danh sach don: mac dinh 3 don gan nhat, "Xem thêm" de mo rong toan bo lich su don
  // (dang cuon, scrollable). Don bi nghi mat 3 so 0 co nut × ben canh so tien de xoa nhanh.
  function _renderOrderListHtml_(orders, expanded, dupFlags) {
    if (!orders.length) return '';
    const list = expanded ? orders : orders.slice(0, 3);
    const rowsHtml = list.map(o => {
      const d = fmtDate_(o.date);
      const rev = o.revenue ? Number(o.revenue).toLocaleString('vi-VN')+'đ' : '';
      const sp  = (o.product||'') + (o.productDetail?' — '+o.productDetail:'');
      const key  = (o.sheet && o.rowIndex) ? (o.sheet+'|'+o.rowIndex) : '';
      const flag = key && dupFlags[key];
      const xBtn = flag
        ? `<button type="button" class="zai-order-x" data-sheet="${escHtml(o.sheet)}" data-row="${o.rowIndex}" data-label="${escHtml(d+' | '+rev+' | '+sp)}" title="Nghi trùng, thiếu 3 số 0 (đúng phải là ${flag.correct.toLocaleString('vi-VN')}đ) — bấm để xóa" style="margin-left:6px;color:#dc2626;border:none;background:none;cursor:pointer;font-weight:700;padding:0 4px;font-size:13px">×</button>`
        : '';
      return `<div style="padding:2px 0">• <b>${d}</b> | ${rev}${xBtn}<br>&nbsp;&nbsp;${escHtml(sp)}</div>`;
    }).join('');
    const body = expanded
      ? `<div style="max-height:240px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;padding:4px 6px;margin-top:4px">${rowsHtml}</div>`
      : rowsHtml;
    const toggle = orders.length > 3
      ? `<button type="button" class="zai-btn zai-btn-ghost zai-btn-sm zai-orders-toggle" style="margin-top:4px">${expanded ? 'Thu gọn ▲' : 'Xem thêm '+(orders.length-3)+' đơn ▾'}</button>`
      : '';
    return `<strong>Đơn gần nhất:</strong><br>${body}${toggle}`;
  }

  // Xoa 1 dong don le (dung cho nut × ben canh so tien) — xac nhan truoc, xoa thang tren
  // Sheet (chinh la Sasum) roi lam moi lai the tu server de dam bao da dong bo.
  async function _zaiDeleteOneOrder_(phone, sheet, rowIndex, label) {
    if (!GAS_URL) { alert('Chưa cấu hình Google Sheets URL.'); return; }
    if (!sheet || !rowIndex) return;
    if (!confirm('Xóa đơn nghi trùng (thiếu 3 số 0) sau đây?\n\n' + label + '\n\nKhông thể hoàn tác.')) return;
    try {
      const r = await fetch(GAS_URL, { method:'POST', body: JSON.stringify({
        action:'deleteDuplicateOrders', items:[{ sheet, rowIndex }]
      }), headers:{'Content-Type':'text/plain'} });
      const d = await r.json();
      if (!d.ok) { alert('Lỗi xóa: ' + (d.error || 'không rõ')); return; }
      delete _lookupCache[phone];
      await _zaiForceRefresh_(phone); // luon ve lai the + dong bo lai voi Sasum
      showMsg('zai-save-status', '🗑️ Đã xóa đơn trùng và đồng bộ Sasum.', 3000);
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    }
  }

  // Chi ve lai khung the thong tin (doc, an toan de goi lai khi poll ma khong lam mat du lieu CS dang go)
  function renderCustCard_(area, phone, raw, care, orders) {
    const name   = orders.length ? (orders[0].name||raw) : (care&&care.name||raw);
    const prods  = [...new Set(orders.map(o=>o.product).filter(Boolean))].join(', ');
    const totRev = orders.reduce((s,o)=>s+(parseFloat(o.revenue)||0),0);
    let expanded = false;

    area.innerHTML = `
      <div class="zai-card">
        <div class="zai-card-name">${escHtml(name)} <span style="font-size:11px;font-weight:400;color:#9ca3af">${escHtml(raw)}</span></div>
        <div class="zai-chips">
          ${orders.length ? `<span class="zai-chip">📦 ${orders.length} đơn</span>` : ''}
          ${totRev ? `<span class="zai-chip">💰 ${Math.round(totRev/1000)}K</span>` : ''}
          ${prods ? `<span class="zai-chip">🏷 ${escHtml(prods)}</span>` : ''}
          ${care&&care.status ? `<span class="zai-chip">📋 ${escHtml(care.status)}</span>` : ''}
          ${care&&care.zalo  ? `<span class="zai-chip">💬 ${escHtml(care.zalo)}</span>` : ''}
          ${care&&care.cs    ? `<span class="zai-chip">👤 ${escHtml(care.cs)}</span>` : ''}
          ${care&&care.schedHen ? `<span class="zai-chip">📅 ${fmtDate_(care.schedHen)}</span>` : ''}
        </div>
        ${care&&care.note ? `<div class="zai-card-note">📝 ${escHtml(_latestNoteText_(care.note))}</div>` : ''}
        <div class="zai-card-orders" id="zai-orders-box"></div>
        ${orders.length > 1 ? `<button type="button" class="zai-btn zai-btn-ghost zai-btn-sm zai-dup-btn" style="margin-top:6px;color:#dc2626" title="Kiểm tra & xóa đơn hàng bị trùng (cùng tháng + doanh thu) của khách này">🗑️ Kiểm tra đơn trùng</button>` : ''}
      </div>`;

    const dupBtn = area.querySelector('.zai-dup-btn');
    if (dupBtn) dupBtn.onclick = () => zaiCheckDuplicates_(phone);

    const dupFlags  = _dupRevenueFlags_(orders);
    const ordersBox = area.querySelector('#zai-orders-box');
    function paintOrders() {
      if (!ordersBox) return;
      ordersBox.innerHTML = _renderOrderListHtml_(orders, expanded, dupFlags);
      const toggleBtn = ordersBox.querySelector('.zai-orders-toggle');
      if (toggleBtn) toggleBtn.onclick = () => { expanded = !expanded; paintOrders(); };
      ordersBox.querySelectorAll('.zai-order-x').forEach(btn => {
        btn.onclick = () => _zaiDeleteOneOrder_(phone, btn.dataset.sheet, Number(btn.dataset.row), btn.dataset.label);
      });
    }
    paintOrders();
    return name;
  }

  function renderCard_(area, updSec, phone, raw, care, orders) {
    const name = renderCustCard_(area, phone, raw, care, orders);
    _currentCustData = {phone, name, care, orders};
    _lastServerCare  = care || {}; // baseline moi de so sanh khi poll (phat hien CS dang sua field nao)

    updSec.style.display = 'block';
    document.getElementById('zai-status-sel').value = care&&care.status||'';
    document.getElementById('zai-zalo-sel').value   = care&&care.zalo||'';
    // CS chăm sóc: đồng bộ từ server (care.cs), fallback nếu không có từ server thì dùng _currentCS
    document.getElementById('zai-cs-sel').value     = care&&care.cs || _currentCS || '';
    const nzF = document.getElementById('zai-nz-form-sel');
    if (nzF) nzF.value = _currentZaloNick || '';
    document.getElementById('zai-hen-date').value   = care&&care.schedHen ? toInputDate_(care.schedHen) : '';
    document.getElementById('zai-hen-note').value   = care&&care.schedHenNote||'';
    document.getElementById('zai-kh-status-sel').value = care&&care.khStatus||'';
    document.getElementById('zai-birthday').value   = care&&care.birthday||'';
    // Ghi chú CS: đọc dữ liệu (đồng bộ 2 chiều với Sasum, cùng định dạng JSON [{text,user,time}])
    const noteNewEl = document.getElementById('zai-note-new');
    if (noteNewEl) noteNewEl.value = '';
    const rawEl = document.getElementById('zai-note-raw');
    const noteRaw = (care && care.note) || '';
    if (rawEl) rawEl.value = noteRaw;
    renderNoteHistory_(noteRaw);
    _updatePerPhoneToggleUI_(phone);
  }

  // ── ĐỒNG BỘ GẦN-TỨC-THỜI (polling) ──
  // Cu moi POLL_INTERVAL_MS, neu panel dang mo va co khach dang xem, kiem tra GAS
  // xem co ai vua luu thay doi (tu Sasum hoac tu Zalo AI o may khac) khong. Neu co,
  // cap nhat lai the thong tin + cac field CHUA duoc CS tu sua (tranh ghi de luc dang go).
  async function pollCareTick_() {
    if (_pollInFlight) return;
    if (!GAS_URL || !_currentCustData || !_currentCustData.phone) return;
    const panel = document.getElementById('ome-zai-panel');
    if (!panel || !panel.classList.contains('open')) return;
    if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') return;
    _pollInFlight = true;
    const phone = _currentCustData.phone;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=lookup&phone=' + encodeURIComponent(phone) + '&_ts=' + Date.now(), {redirect:'follow'});
      const d = await r.json();
      if (d.error) return;
      if (!_currentCustData || _currentCustData.phone !== phone) return; // CS da chuyen sang khach khac trong luc cho fetch
      const newCare   = d.care || null;
      const newOrders = (d.orders||[]).slice().sort((a,b) => parseDate_(b.date)-parseDate_(a.date));
      const oldUpdated = _lastServerCare && _lastServerCare.updated;
      const newUpdated = newCare && newCare.updated;
      const changed = (newUpdated || '') !== (oldUpdated || '') || newOrders.length !== (_currentCustData.orders||[]).length;
      if (!changed) return;
      applyPolledCare_(phone, newCare, newOrders);
    } catch(e) { /* im lang, thu lai lan poll sau */ }
    finally { _pollInFlight = false; }
  }

  function applyPolledCare_(phone, newCare, newOrders) {
    const area = document.getElementById('zai-cust-area');
    const raw  = (document.getElementById('zai-phone-input') && document.getElementById('zai-phone-input').value) || phone;
    if (area) renderCustCard_(area, phone, raw, newCare, newOrders);

    const baseline = _lastServerCare || {};
    const c = newCare || {};

    // Field don gian: chi tu dong cap nhat neu CS CHUA sua (gia tri hien tai == baseline cu)
    function syncField(id, key) {
      const el = document.getElementById(id); if (!el) return;
      const baseVal = baseline[key] || '';
      if ((el.value||'') === baseVal) el.value = c[key] || '';
    }
    syncField('zai-status-sel','status');
    syncField('zai-zalo-sel','zalo');
    syncField('zai-kh-status-sel','khStatus');
    syncField('zai-hen-note','schedHenNote');
    syncField('zai-birthday','birthday');
    const henDateEl = document.getElementById('zai-hen-date');
    if (henDateEl) {
      const baseHen = baseline.schedHen ? toInputDate_(baseline.schedHen) : '';
      if ((henDateEl.value||'') === baseHen) henDateEl.value = c.schedHen ? toInputDate_(c.schedHen) : '';
    }

    // Ghi chú: giữ lại các mục CS vừa bấm "+" nhưng CHƯA lưu (pending), rồi ghép với bản mới nhất từ server
    const rawEl = document.getElementById('zai-note-raw');
    if (rawEl) {
      const localArr  = _parseNotes(rawEl.value);
      const baseArr   = _parseNotes(baseline.note || '');
      const serverArr = _parseNotes(c.note || '');
      const baseKeys  = new Set(baseArr.map(n => JSON.stringify(n)));
      const pendingLocal = localArr.filter(n => !baseKeys.has(JSON.stringify(n)));
      const merged = pendingLocal.concat(serverArr);
      rawEl.value = _notesToStr(merged);
      renderNoteHistory_(rawEl.value);
    }

    _currentCustData.care   = c;
    _currentCustData.orders = newOrders;
    _lastServerCare = c;
    _lookupCache[phone] = {care: c, orders: newOrders, ts: Date.now()};
    showMsg('zai-save-status', '🔄 Vừa đồng bộ dữ liệu mới từ Sasum', 2500);
  }

  function startCarePoll_() {
    if (_carePollStarted) return;
    _carePollStarted = true;
    setInterval(pollCareTick_, POLL_INTERVAL_MS);
  }

  // ── SAVE STATUS ──
  async function doSaveStatus() {
    if (!_currentCustData) { showError('Chưa tra cứu khách nào.'); return; }
    if (!GAS_URL) { showError('Chưa cài đặt URL GAS.'); return; }
    const status  = document.getElementById('zai-status-sel').value;
    const zalo    = document.getElementById('zai-zalo-sel').value;
    // CS chăm sóc luôn = CS đang chọn ở thanh trên (mục 1), đồng bộ 2 chiều với Sasum
    const cs      = _currentCS || '';
    const henDate = document.getElementById('zai-hen-date').value;
    const henNote = document.getElementById('zai-hen-note').value.trim();
    const care    = (_currentCustData && _currentCustData.care) || null;
    // Ghi chú CS: dang JSON [{text,user,time}] giong Sasum, da duoc build san qua nut "+"
    const rawEl   = document.getElementById('zai-note-raw');
    const note    = (rawEl ? rawEl.value : '') || (care && care.note) || '';
    const btn    = document.getElementById('zai-save-btn');
    btn.disabled = true; btn.textContent = 'Đang lưu...';
    try {
      const c = care||{};
      const birthday = document.getElementById('zai-birthday') ? document.getElementById('zai-birthday').value : '';
      const row = {
        phone:_currentCustData.phone, status:status||c.status||'',
        zalo:zalo||c.zalo||'', cs:cs||c.cs||'', note,
        schedules:c.schedules||'', schedGoi:c.schedGoi||'', schedGoiNote:c.schedGoiNote||'',
        schedSP:c.schedSP||'', schedSPNote:c.schedSPNote||'',
        schedCS:c.schedCS||'', schedCSNote:c.schedCSNote||'',
        schedHen:henDate||c.schedHen||'', schedHenNote:henNote||c.schedHenNote||'',
        khStatus: document.getElementById('zai-kh-status-sel').value || (c.khStatus||''),
        birthday: birthday || c.birthday || '',
        nickZalos: (() => {
          const existing = c.nickZalos || [];
          if (_currentZaloNick && !existing.includes(_currentZaloNick)) return [...existing, _currentZaloNick];
          return existing;
        })()
      };
      const res = await fetch(GAS_URL, {method:'POST', body:JSON.stringify({action:'saveSingle',row}), headers:{'Content-Type':'text/plain'}});
      const d = await res.json();
      if (d.ok) {
        showMsg('zai-save-status','✓ Đã lưu lên GSheet!',3000);
        delete _lookupCache[_currentCustData.phone];
        // Cap nhat baseline ngay de lan poll ke tiep khong bao "co ban moi" voi chinh du lieu vua luu
        const savedCare = { ...row, updated: new Date().toISOString() };
        _currentCustData.care = savedCare;
        _lastServerCare = savedCare;
      } else { showError('Lỗi: '+JSON.stringify(d)); }
    } catch(e) { showError('Lỗi kết nối: '+e.message); }
    finally { btn.disabled=false; btn.textContent='💾 Lưu về GSheet'; }
  }

  // ── BUILD CUST LINES cho AI ──
  function buildCustLines() {
    if (!_currentCustData) return [];
    const {name, phone, care, orders} = _currentCustData;
    const lines = ['Tên: '+name+' | SĐT: '+phone];
    if (orders&&orders.length) {
      lines.push('Số đơn đã mua: '+orders.length);
      const prods = [...new Set(orders.map(o=>o.product).filter(Boolean))].slice(0,5).join(', ');
      if (prods) lines.push('Sản phẩm đã mua: '+prods);
      const last = orders[0];
      if (last) {
        const d = fmtDate_(last.date);
        lines.push('Đơn gần nhất: '+[d,last.product,last.revenue?Number(last.revenue).toLocaleString('vi-VN')+'đ':''].filter(Boolean).join(' - '));
      }
    }
    if (care&&care.status) lines.push('Tình trạng CS: '+care.status);
    if (care&&care.note) {
      const latest = _latestNoteText_(care.note);
      if (latest) lines.push('Ghi chú: '+latest);
    }
    return lines;
  }

  // 3 huong mo dau khac nhau — CS chon huong hop voi tinh huong tung khach thay vi chi
  // co 1 goi y duy nhat. Moi huong deu duoc AI viet dua tren ho so mua hang + (neu co)
  // lich su chat gan day, de tranh lap lai chuyen da noi va bam sat dung khach that.
  const OPENER_ANGLES = [
    { key:'follow',  label:'🩺 Hỏi thăm trải nghiệm', instr:'Hỏi thăm cảm nhận/trải nghiệm khách sau khi dùng sản phẩm đã mua gần nhất, thể hiện sự quan tâm chân thành.' },
    { key:'upsell',  label:'🛍 Gợi ý sản phẩm liên quan', instr:'Gợi ý nhẹ nhàng 1 sản phẩm liên quan hoặc dùng kèm với sản phẩm khách đã mua, mở đầu bằng câu hỏi/quan tâm chứ không chào bán trực tiếp.' },
    { key:'connect', label:'✨ Khơi gợi trò chuyện',    instr:'Mở đầu bằng 1 câu hỏi mở hoặc chia sẻ nhỏ (ưu đãi mới, mẹo dùng sản phẩm, hỏi thăm dịp gần đây) để khơi gợi khách phản hồi, tạo cảm giác gần gũi cá nhân.' }
  ];

  // Goi AI qua GAS — TUAN TU + tu retry khi Groq bao 429 (rate limit theo token/phut).
  // Groq tra ve "Please try again in X.XXs" -> doi dung X giay roi thu lai (toi da 2 lan).
  async function _aiCall_(prompt) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      let data;
      try {
        const res = await fetch(GAS_URL, {method:'POST', body:JSON.stringify({action:'ai',prompt,withProducts:_useProducts}), headers:{'Content-Type':'text/plain'}});
        data = await res.json();
      } catch(e) { return { error: e.message }; }
      if (data && data.ok) return data;
      const err = String((data && data.error) || 'Lỗi GAS');
      if (err.indexOf('429') !== -1 && attempt < 2) {
        const m = err.match(/try again in ([0-9.]+)s/i);
        const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : 16000;
        await sleep_(waitMs);
        continue;
      }
      return { error: err };
    }
    return { error: 'Quá số lần thử lại' };
  }

  async function doGenerateOpener() {
    if (!GAS_URL) { showError('Chưa cài đặt URL GAS.'); return; }
    if (!_currentCustData) { showError('Tra cứu khách trước đã.'); return; }
    const btn = document.getElementById('zai-open-btn');
    const sug = document.getElementById('zai-sug-area');
    hideError(); btn.disabled=true; btn.textContent='AI đang soạn...';
    sug.innerHTML='<div class="zai-loading"><div class="zai-spinner"></div>Đang soạn 3 câu mở đầu...</div>';

    const lines = buildCustLines();
    const ctx = (document.getElementById('zai-ctx').value||'').trim();
    if (ctx) lines.push('Ngữ cảnh: '+ctx);
    // Lich su chat gan day (neu co) chi de AI THAM KHAO, tranh lap lai chu de da noi —
    // KHONG phai de tra loi truc tiep tin cuoi (do la viec cua nut "Tạo gợi ý phản hồi").
    let histText = _chatHistory.length ? _chatHistory.slice(-8).join(' | ') : '';
    if (histText.length > 1200) histText = histText.slice(-1200); // giu prompt nhe de khong cham tran token/phut cua Groq
    const custBlock = '[KH] '+lines.join(' | ')+
      (histText ? '\n[Đã từng trò chuyện — chỉ để tham khảo, KHÔNG lặp lại chủ đề này] '+histText : '');

    try {
      // TUAN TU tung huong (khong Promise.all): Groq gioi han token/PHUT,
      // ban 3 request cung luc chac chan dinh 429 — tuan tu + retry thi on dinh.
      const results = [];
      for (let ai = 0; ai < OPENER_ANGLES.length; ai++) {
        const angle = OPENER_ANGLES[ai];
        sug.innerHTML = '<div class="zai-loading"><div class="zai-spinner"></div>Đang soạn câu ' + (ai+1) + '/' + OPENER_ANGLES.length + ' — ' + escHtml(angle.label) + '...</div>';
        const prompt = custBlock+'\n[Giọng văn] '+_activeTone+
          '\nSoạn 1 tin nhắn Zalo CHỦ ĐỘNG bắt chuyện với khách, theo hướng: '+angle.instr+
          ' Ngắn gọn, tự nhiên, tiếng Việt, không giống mẫu quảng cáo.';
        const data = await _aiCall_(prompt);
        if (data.error) results.push({ angle, error: data.error });
        else results.push({ angle, prompt, text: (data.text||'').trim() });
      }

      sug.innerHTML='';
      addEl(sug,'div',{className:'zai-section-label',textContent:'💡 3 câu mở đầu — sửa nếu cần rồi gửi'});
      results.forEach((r) => {
        const box = addEl(sug,'div',{style:'border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-top:6px;background:#fafafa'});
        addEl(box,'div',{style:'font-size:11px;font-weight:600;color:#374151;margin-bottom:4px',textContent:r.angle.label});
        if (r.error) { addEl(box,'div',{className:'zai-error',style:'display:block',textContent:'Lỗi: '+r.error}); return; }
        const ta = addEl(box,'textarea',{rows:3});
        ta.style.cssText='width:100%;box-sizing:border-box;font-size:12px;padding:7px;border:1px solid #d1d5db;border-radius:6px;resize:vertical;font-family:inherit';
        ta.value = r.text;
        attachExpandBtn_(box, ta, r.angle.label);
        const btnRow = addEl(box,'div',{style:'display:flex;gap:6px;margin-top:6px'});
        const sendZaloBtn = addEl(btnRow,'button',{className:'zai-btn zai-btn-primary zai-btn-sm',textContent:'📤 Gởi Zalo'});
        sendZaloBtn.title='Tự điền vào ô chat Zalo và gởi ngay';
        sendZaloBtn.addEventListener('click',() => sendToZalo_(ta.value, sendZaloBtn));
        const saveBtn2 = addEl(btnRow,'button',{className:'zai-btn zai-btn-secondary zai-btn-sm',textContent:'💾 Lưu mẫu'});
        saveBtn2.title='Lưu câu này (sau khi sửa) làm mẫu để AI học';
        saveBtn2.addEventListener('click',() => saveAIExample_(r.prompt, ta.value, saveBtn2));
      });
    } catch(e) { sug.innerHTML=''; showError('Lỗi: '+e.message); }
    finally { btn.disabled=false; btn.textContent='💬 Tạo 3 câu mở đầu đa dạng (mua hàng + chat)'; }
  }

  async function doGenerate() {
    if (!GAS_URL) { showError('Chưa cài đặt URL GAS.'); return; }
    // Uu tien _chatHistory, fallback textarea
    const histText = _chatHistory.length ? _chatHistory.join('\n---\n') : '';
    const taText   = (document.getElementById('zai-msg').value||'').trim();
    const msg = histText || taText;
    if (!msg) { showError('Chưa có tin nhắn khách. Nhấn 📥 Lấy TN hoặc dán thủ công.'); return; }
    const btn = document.getElementById('zai-gen-btn');
    const sug = document.getElementById('zai-sug-area');
    hideError(); btn.disabled=true; btn.textContent='AI đang soạn...';
    sug.innerHTML='<div class="zai-loading"><div class="zai-spinner"></div>Đang tạo gợi ý...</div>';
    const lines = buildCustLines();
    const ctx = (document.getElementById('zai-ctx').value||'').trim();
    if (ctx) lines.push('Ngữ cảnh: '+ctx);
    const prompt = (lines.length?'[KH] '+lines.join(' | ')+'\n':'')+
      '[TN khách] '+msg+'\n[Giọng văn] '+_activeTone+'\nSoạn 1 tin nhắn trả lời phù hợp, ngắn gọn, tiếng Việt tự nhiên.';
    await callAI_(prompt, btn, '✨ Tạo gợi ý phản hồi', sug);
  }

  async function callAI_(prompt, btn, label, sug) {
    try {
      const data = await _aiCall_(prompt);
      if (data.error) throw new Error(data.error);
      const text = (data.text||'').trim();
      sug.innerHTML='';
      addEl(sug,'div',{className:'zai-section-label',textContent:'💡 Gợi ý — sửa nếu cần rồi copy/lưu'});

      const ta = addEl(sug,'textarea',{id:'zai-sug-edit', rows:4});
      ta.style.cssText='width:100%;box-sizing:border-box;font-size:12px;padding:8px;border:1px solid #d1d5db;border-radius:6px;resize:vertical;margin-top:4px;font-family:inherit';
      ta.value = text;
      attachExpandBtn_(sug, ta, 'Gợi ý trả lời');

      const btnRow = addEl(sug,'div',{style:'display:flex;gap:6px;margin-top:6px'});

      const sendZaloBtn = addEl(btnRow,'button',{className:'zai-btn zai-btn-primary zai-btn-sm',textContent:'📤 Gởi Zalo'});
      sendZaloBtn.title='Tự điền vào ô chat Zalo và gởi ngay';
      sendZaloBtn.addEventListener('click',() => sendToZalo_(ta.value, sendZaloBtn));

      const saveBtn2 = addEl(btnRow,'button',{className:'zai-btn zai-btn-secondary zai-btn-sm',textContent:'💾 Lưu mẫu'});
      saveBtn2.title='Lưu câu trả lời này (sau khi sửa) làm mẫu để AI học';
      saveBtn2.addEventListener('click',() => saveAIExample_(prompt, ta.value, saveBtn2));

    } catch(e) { sug.innerHTML=''; showError('Lỗi: '+e.message); }
    finally { btn.disabled=false; btn.textContent=label; }
  }

  // Gui tin nhan vao o chat Zalo
  function sendToZalo_(text, btn) {
    if (!text.trim()) return;
    const INPUT_SELS = [
      '[class*="chat-input"] [contenteditable]',
      '[class*="message-input"] [contenteditable]',
      '[class*="input-box"] [contenteditable]',
      '[class*="input-area"] [contenteditable]',
      '[class*="editor"] [contenteditable]',
      '[contenteditable="true"]',
    ];
    let inputEl = null;
    for (const sel of INPUT_SELS) {
      try {
        const els = [...document.querySelectorAll(sel)];
        const el = els.find(e => { const r=e.getBoundingClientRect(); return r.height>20&&r.height<300&&r.width>100; });
        if (el) { inputEl=el; break; }
      } catch(e) {}
    }
    if (!inputEl) {
      navigator.clipboard.writeText(text).then(()=>{
        if(btn){btn.textContent='✓ Đã copy (không tìm được ô chat)';setTimeout(()=>{btn.textContent='📤 Gởi Zalo';},2500);}
      });
      return;
    }
    inputEl.focus();
    const sel2 = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    sel2.removeAllRanges(); sel2.addRange(range);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, text);
    inputEl.dispatchEvent(new InputEvent('input',{bubbles:true,data:text}));
    setTimeout(()=>{
      const SEND_SELS = [
        'button[class*="send"]','[class*="btn-send"]','[class*="sendBtn"]',
        '[class*="send-btn"]','[class*="icon-send"]',
      ];
      let sent=false;
      for (const s of SEND_SELS) {
        try { const b=document.querySelector(s); if(b){b.click();sent=true;break;} } catch(e){}
      }
      if (!sent) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));
        inputEl.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,which:13,bubbles:true}));
      }
      if(btn){btn.textContent='✓ Đã gởi!';setTimeout(()=>{btn.textContent='📤 Gởi Zalo';},2000);}
    }, 150);
  }

  async function saveAIExample_(prompt, corrected, btn) {
    if (!GAS_URL) { showError('Chưa cài URL GAS.'); return; }
    if (!corrected.trim()) { showError('Câu trả lời trống.'); return; }
    btn.disabled=true; btn.textContent='Đang lưu...';
    try {
      const r = await fetch(GAS_URL, {
        method:'POST',
        body: JSON.stringify({action:'saveAIContext', type:'combo_template', content: corrected.trim(), context: prompt.slice(0,300)}),
        headers:{'Content-Type':'text/plain'}
      });
      const d = await r.json();
      if (d.ok) { btn.textContent='✓ Đã lưu!'; setTimeout(()=>{btn.textContent='💾 Lưu mẫu';btn.disabled=false;},2000); }
      else { showError('Lỗi lưu mẫu: '+JSON.stringify(d)); btn.disabled=false; btn.textContent='💾 Lưu mẫu'; }
    } catch(e) { showError('Lỗi: '+e.message); btn.disabled=false; btn.textContent='💾 Lưu mẫu'; }
  }

  // ── DATE HELPERS ──
  function parseDate_(d) {
    if (!d) return 0;
    if (typeof d==='number') return (d - 25569) * 86400000;
    const s = String(d).trim();
    // Full ISO with time (e.g. GAS Date object -> "2026-04-17T17:00:00.000Z")
    // Must use new Date() to preserve timezone offset correctly
    if (s.includes('T')) { const dt=new Date(s); return isNaN(dt)?0:dt.getTime(); }
    // DD/MM/YYYY (dinh dang Viet Nam tu GAS Utilities.formatDate)
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m1) return new Date(+m1[3],+m1[2]-1,+m1[1]).getTime();
    // YYYY-MM-DD (ISO date only, no timezone shift needed)
    const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) return new Date(+m2[1],+m2[2]-1,+m2[3]).getTime();
    const dt = new Date(s);
    return isNaN(dt) ? 0 : dt.getTime();
  }
  function fmtDate_(d) {
    const ts = parseDate_(d); if (!ts) return '?';
    const dt = new Date(ts);
    return ('0'+dt.getDate()).slice(-2)+'/'+('0'+(dt.getMonth()+1)).slice(-2)+'/'+dt.getFullYear();
  }
  function toInputDate_(d) {
    const ts = parseDate_(d); if (!ts) return '';
    const dt = new Date(ts);
    return dt.getFullYear()+'-'+('0'+(dt.getMonth()+1)).slice(-2)+'-'+('0'+dt.getDate()).slice(-2);
  }

  function showError(msg) { const el=document.getElementById('zai-error'); if(el){el.textContent=msg;el.style.display='block';} }
  function hideError()    { const el=document.getElementById('zai-error'); if(el) el.style.display='none'; }
  function showMsg(id,msg,ms) { const el=document.getElementById(id); if(!el) return; el.textContent=msg; if(ms) setTimeout(()=>{el.textContent='';},ms); }
  function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── GHI CHÚ CS: luu mang JSON [{text,user,time}], giong het dinh dang Sasum (app web) ──
  function _parseNotes(raw) {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr; // dinh dang moi
    } catch(e) {}
    // dinh dang cu (text thuan) → wrap thanh 1 muc khong co user/time
    return [{ text: raw, user: '', time: '' }];
  }
  function _notesToStr(arr) { return JSON.stringify(arr); }
  function _latestNoteText_(raw) {
    const arr = _parseNotes(raw);
    return arr.length ? arr[0].text : '';
  }
  function _fmtNoteTime(d) {
    const h  = String(d.getHours()).padStart(2,'0');
    const m  = String(d.getMinutes()).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    return `${h}:${m} ${dd}/${mm}/${yy}`;
  }
  function renderNoteHistory_(raw) {
    const hist = document.getElementById('zai-note-history');
    if (!hist) return;
    const arr = _parseNotes(raw);
    if (!arr.length) { hist.innerHTML = '<div class="zai-note-empty">Chưa có ghi chú nào</div>'; return; }
    hist.innerHTML = arr.map((n,i) => {
      const meta = [n.user, n.time].filter(Boolean).join(' · ');
      return `<div class="zai-note-entry">
        ${meta ? `<div class="zai-note-meta">${n.user?`<b>${escHtml(n.user)}</b>`:''}${n.time?' '+escHtml(n.time):''}${i===0?' <span class="zai-note-latest">MỚI NHẤT</span>':''}</div>` : ''}
        <div class="zai-note-text">${escHtml(n.text).replace(/\n/g,'<br>')}</div>
        <button class="zai-note-del" data-idx="${i}" title="Xóa ghi chú này">✕</button>
      </div>`;
    }).join('');
    hist.querySelectorAll('.zai-note-del').forEach(b => {
      b.addEventListener('click', () => deleteNoteEntry_(parseInt(b.dataset.idx,10)));
    });
  }
  function addNoteEntry_() {
    const inp = document.getElementById('zai-note-new');
    const text = (inp ? inp.value : '').trim();
    if (!text) {
      if (inp) { inp.style.border = '1px solid #ef4444'; setTimeout(() => { inp.style.border = ''; }, 1200); }
      return;
    }
    const rawEl = document.getElementById('zai-note-raw');
    const arr = _parseNotes(rawEl ? rawEl.value : '');
    const userName = _currentCS || 'CS';
    arr.unshift({ text, user: userName, time: _fmtNoteTime(new Date()) });
    const newRaw = _notesToStr(arr);
    if (rawEl) rawEl.value = newRaw;
    if (inp) inp.value = '';
    renderNoteHistory_(newRaw);
  }
  function deleteNoteEntry_(idx) {
    if (!confirm('Xóa ghi chú này?')) return;
    const rawEl = document.getElementById('zai-note-raw');
    const arr = _parseNotes(rawEl ? rawEl.value : '');
    arr.splice(idx, 1);
    const newRaw = _notesToStr(arr);
    if (rawEl) rawEl.value = newRaw;
    renderNoteHistory_(newRaw);
  }

  async function doneReminder_(phone) {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      await fetch(GAS_URL + sep + 'action=saveSingle', {
        method: 'POST', redirect: 'follow',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({phone, schedHen:'', schedHenNote:''})
      });
    } catch(e) {}
  }

  let _remindOpen = false; // lich hen mac dinh DONG — CS tu bam mo xem chi tiet
  function renderReminderPanel_(reminders) {
    let panel = document.getElementById('zai-remind-panel');
    const host = document.getElementById('ome-zai-panel');
    if (!host) return;
    const csBar = document.getElementById('zai-cs-bar');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'zai-remind-panel';
      panel.style.cssText = 'background:#fef2f2;border-bottom:2px solid #fca5a5;font-size:11px;';
      if (csBar && csBar.nextSibling) host.insertBefore(panel, csBar.nextSibling);
      else host.insertBefore(panel, host.firstChild);
    }
    const toggleBtn = document.getElementById('ome-zai-toggle');
    if (!reminders || !reminders.length) {
      panel.style.display = 'none';
      if (toggleBtn) toggleBtn.style.boxShadow = '';
      return;
    }
    if (toggleBtn) toggleBtn.style.boxShadow = '0 0 0 3px #ef4444';
    panel.style.display = '';
    const today = new Date(); today.setHours(0,0,0,0);
    panel.innerHTML =
      '<div style="padding:5px 10px;background:#fca5a5;color:#7f1d1d;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">'+
      '<span>🔔 ' + reminders.length + ' lịch hẹn</span>'+
      '<span id="zai-remind-toggle" style="cursor:pointer;font-size:11px;user-select:none;">' + (_remindOpen ? '▲ thu gọn' : '▼ mở rộng') + '</span></div>'+
      '<div id="zai-remind-list" style="max-height:180px;overflow-y:auto;display:' + (_remindOpen ? '' : 'none') + ';"></div>';
    const list = panel.querySelector('#zai-remind-list');
    reminders.forEach(rem => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid #fecaca;';
      const henDate = rem.schedHen ? new Date(rem.schedHen) : null;
      if (henDate) henDate.setHours(0,0,0,0);
      const isOverdue = henDate && henDate < today;
      // Phone copy button
      const phoneBtn = document.createElement('button');
      phoneBtn.textContent = '📋 ' + rem.phone;
      phoneBtn.title = 'Bấm để copy số';
      phoneBtn.style.cssText = 'background:#fff;border:1px solid #fca5a5;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;font-family:monospace;white-space:nowrap;flex-shrink:0;';
      phoneBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(rem.phone).catch(()=>{});
        const orig = phoneBtn.textContent;
        phoneBtn.textContent = '✓ đã copy';
        setTimeout(() => { phoneBtn.textContent = orig; }, 1200);
      });
      // Tag + note
      const note = document.createElement('span');
      note.style.cssText = 'flex:1;font-size:10px;color:#7f1d1d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;';
      note.title = rem.schedHenNote || '';
      const tagColor = isOverdue ? '#ef4444' : '#f97316';
      const tagText = isOverdue ? 'Quá hạn' : 'Hôm nay';
      // So sanh trang thai Zalo MOI NHAT tu server (rem.zalo) voi ban ghi CS dang cache cuc bo
      // (_lookupCache) — neu lech nhau nghia la vua co ai do doi tren Sasum (appweb) nhung
      // Zalo AI extension may nay chua tra cuu lai nen con hien cache cu.
      const cachedCare = _lookupCache[rem.phone] && _lookupCache[rem.phone].care;
      const staleZalo = cachedCare && rem.zalo && cachedCare.zalo && cachedCare.zalo !== rem.zalo;
      const staleTag = staleZalo ? '<span title="Sasum vừa đổi Kết bạn Zalo thành \''+escHtml(rem.zalo)+'\' — bấm Mở KH để cập nhật lại cache" style="background:#facc15;color:#7c2d12;border-radius:2px;padding:0 3px;font-size:9px;margin-right:3px;">⚠ lệch Zalo</span>' : '';
      note.innerHTML = '<span style="background:'+tagColor+';color:#fff;border-radius:2px;padding:0 3px;font-size:9px;margin-right:3px;">'+tagText+'</span>' + staleTag + escHtml(rem.schedHenNote || '—');
      // Mở KH → tra cứu ngay trong panel Zalo AI (điền SDT + lookup, đồng bộ về Sasum khi lưu)
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Mở KH';
      openBtn.style.cssText = 'background:#3b82f6;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;flex-shrink:0;';
      openBtn.addEventListener('click', () => {
        const inp = document.getElementById('zai-phone-input');
        if (inp) inp.value = rem.phone;
        delete _lookupCache[rem.phone]; // buoc tra cuu lai moi, khong dung cache cu (tranh lech nhu tren)
        doLookup();
        const bodyEl = document.getElementById('zai-body');
        if (bodyEl) bodyEl.scrollTop = 0;
      });
      // Done
      const doneBtn = document.createElement('button');
      doneBtn.textContent = '✓ Done';
      doneBtn.style.cssText = 'background:#22c55e;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;flex-shrink:0;';
      doneBtn.addEventListener('click', async () => {
        doneBtn.disabled = true;
        await doneReminder_(rem.phone);
        item.style.opacity = '0.4';
        setTimeout(() => {
          item.remove();
          if (!list.children.length) {
            panel.style.display = 'none';
            if (toggleBtn) toggleBtn.style.boxShadow = '';
          }
        }, 700);
      });
      item.appendChild(phoneBtn);
      item.appendChild(note);
      item.appendChild(openBtn);
      item.appendChild(doneBtn);
      list.appendChild(item);
    });
    panel.querySelector('#zai-remind-toggle').addEventListener('click', () => {
      const l = panel.querySelector('#zai-remind-list');
      const tog = panel.querySelector('#zai-remind-toggle');
      if (!l) return;
      _remindOpen = l.style.display === 'none';
      l.style.display = _remindOpen ? '' : 'none';
      if (tog) tog.textContent = _remindOpen ? '▲ thu gọn' : '▼ mở rộng';
    });
  }
async function startReminderPoll_() {
    if (!GAS_URL || !_currentCS) return;
    if (Notification && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    async function checkReminders() {
      if (!GAS_URL || !_currentCS) return;
      try {
        const sep = GAS_URL.includes('?') ? '&' : '?';
        const r = await fetch(GAS_URL + sep + 'action=reminders&cs=' + encodeURIComponent(_currentCS), {redirect:'follow'});
        const d = await r.json();
        renderReminderPanel_(d.reminders || []);
        if (d.reminders && d.reminders.length && Notification && Notification.permission === 'granted') {
          new Notification('OME: ' + d.reminders.length + ' lịch hẹn hôm nay', {
            body: d.reminders.slice(0,3).map(r2 => r2.phone + (r2.schedHenNote?' - '+r2.schedHenNote:'')).join('\n'),
            icon: ''
          });
        }
      } catch(e) {}
    }
    checkReminders();
    setInterval(checkReminders, 5 * 60 * 1000);
  }


  // Tai "danh ba nguoc" (ten doan chat -> SDT) da hoc cuc bo tren may nay
  function loadChatNamePhoneMap_() {
    chrome.storage.local.get(['ome_chat_name_map'], (res) => {
      _chatNamePhoneMap = res.ome_chat_name_map || {};
    });
  }
  function saveChatNamePhoneMap_() {
    chrome.storage.local.set({ ome_chat_name_map: _chatNamePhoneMap });
  }
  // Ghi nho: ten doan chat dang mo HIEN LA cua SDT nay (CS xac nhan 1 lan, sau do tu nhan dien)
  function learnChatNameForPhone_(name, phone) {
    if (!name || !phone) return;
    const key = name.trim().toLowerCase();
    if (!key) return;
    _chatNamePhoneMap[key] = phone;
    saveChatNamePhoneMap_();
  }

  // Tim SDT cua doan chat dang mo: uu tien tach so tu ten (khach chua ket ban Zalo thuong
  // hien thi thang so DT), neu khong co so thi tra trong danh ba nguoc da hoc cuc bo.
  function resolvePhoneForChatName_(name) {
    if (!name) return null;
    const byDigits = extractPhone(name);
    if (byDigits) return byDigits;
    const key = name.trim().toLowerCase();
    return _chatNamePhoneMap[key] || null;
  }

  async function loadNickZaloList_() {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=getSetting&key=nickZaloList', {redirect:'follow'});
      const d = await r.json();
      let list = [];
      if (d.value) { try { list = JSON.parse(d.value); } catch(e) {} }
      _zaloNickList = Array.isArray(list) ? list : [];
      // Rebuild nzSel dropdown
      const nzSel = document.getElementById('zai-nz-sel');
      if (nzSel) {
        nzSel.innerHTML = '<option value="">-- Chọn nick --</option>';
        _zaloNickList.forEach(n => {
          const o = document.createElement('option'); o.value=n; o.textContent=n; nzSel.appendChild(o);
        });
        if (_currentZaloNick) nzSel.value = _currentZaloNick;
      }
      // zai-nz-form-sel gio la input an, luon dong bo theo nick sticky
      const nzF = document.getElementById('zai-nz-form-sel');
      if (nzF) nzF.value = _currentZaloNick || '';
    } catch(e) {}
  }

  async function loadCSNames_() {
    if (!GAS_URL) return;
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=users', {redirect:'follow'});
      const d = await r.json();
      if (d.users && d.users.length) {
        const active = d.users.filter(u => u.active !== false);
        const names = ['', ...active.map(u => u.username||u.name).filter(Boolean)];
        CS_NAMES = names;
        // zai-cs-sel gio la input an, luon dong bo theo CS sticky (khong can dropdown)
      }
    } catch(e) {}
  }

  // ── TINH TRANG CS: load cay dong tu GAS (dong bo voi appweb) ──
  function careStatusOptionsHtml_(tree, selected) {
    let html = '<option value="">— Chọn —</option>';
    (tree || []).forEach(function(node) {
      if (node.children && node.children.length) {
        html += '<optgroup label="' + escHtml(node.label) + '">';
        node.children.forEach(function(child) {
          if (!child.value) return;
          html += '<option value="' + escHtml(child.value) + '"' + (selected === child.value ? ' selected' : '') + '>' +
                  escHtml(node.label + ' - ' + (child.label || child.value)) + '</option>';
        });
        html += '</optgroup>';
      } else if (node.value) {
        html += '<option value="' + escHtml(node.value) + '"' + (selected === node.value ? ' selected' : '') + '>' +
                escHtml(node.label || node.value) + '</option>';
      }
    });
    return html;
  }

  function rebuildStatusSel_() {
    const sel = document.getElementById('zai-status-sel');
    if (!sel || !Array.isArray(CARE_STATUS_TREE) || !CARE_STATUS_TREE.length) return;
    const cur = sel.value;
    sel.innerHTML = careStatusOptionsHtml_(CARE_STATUS_TREE, cur);
    sel.value = cur;
  }

  async function loadCareStatusTree_() {
    if (!GAS_URL) return;
    const sep = GAS_URL.includes('?') ? '&' : '?';
    let tree = null;
    try {
      const r = await fetch(GAS_URL + sep + 'action=getSetting&key=careStatus', {redirect:'follow'});
      const d = await r.json();
      if (d && d.value) { try { tree = typeof d.value === 'string' ? JSON.parse(d.value) : d.value; } catch(e) {} }
    } catch(e) {}
    if (!Array.isArray(tree) || !tree.length) {
      try {
        const r = await fetch(GAS_URL + sep + 'action=customers', {redirect:'follow'});
        const d = await r.json();
        if (d && Array.isArray(d.careStatus) && d.careStatus.length) tree = d.careStatus;
      } catch(e) {}
    }
    if (Array.isArray(tree) && tree.length) {
      CARE_STATUS_TREE = tree;
      rebuildStatusSel_();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  BROADCAST — Gui tin (+anh) hang loat cho danh sach KH, tu dong
  //  mo tung doan chat va gui, KHONG can tay chon tung khach.
  //
  //  ⚠️ LUU Y QUAN TRONG:
  //  - Cac CSS selector de "tim o tim kiem Zalo" va "tim input dinh kem anh"
  //    (SEARCH_SELS / FILE_INPUT_SELS ben duoi) la best-effort, dua tren cau truc
  //    Zalo Web pho bien. Zalo co the doi giao dien theo thoi gian, nen neu
  //    chien dich bao "Không tìm thấy ô tìm kiếm / input đính kèm ảnh", hay
  //    dung DevTools (F12 -> Inspect) tren o do de lay đúng selector va cap nhat
  //    lai trong file nay.
  //  - Nen bat dau voi 1 chien dich NHO (vai khach) de kiem tra chay dung truoc
  //    khi chay danh sach lon.
  //  - Chi nen dung cho khach da la ban Zalo / da co lich su chat, va da dong y
  //    nhan tin CSKH, de tranh bi Zalo danh dau spam.
  // ═══════════════════════════════════════════════════════════════

  function sleep_(ms) { return new Promise(res => setTimeout(res, ms)); }
  function randDelayMs_(minSec, maxSec) { return (minSec + Math.random() * (maxSec - minSec)) * 1000; }

  // ── GIOI HAN 200 KHACH/NGAY ──
  function todayStr_() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _bcSaveDaily_() {
    chrome.storage.local.set({ ome_bc_daily: { date: _bcDailyDate, count: _bcDailyCount, unlocked: _bcDailyUnlocked } });
  }
  // Sang ngay moi -> tu dong reset ve 0/chua kich hoat lai
  function _bcCheckDailyReset_() {
    const t = todayStr_();
    if (_bcDailyDate !== t) {
      _bcDailyDate = t; _bcDailyCount = 0; _bcDailyUnlocked = false;
      _bcSaveDaily_();
    }
  }
  function _bcDailyLocked_() {
    _bcCheckDailyReset_();
    return _bcDailyCount >= BC_DAILY_LIMIT && !_bcDailyUnlocked;
  }
  function _bcIncrementDaily_() {
    _bcCheckDailyReset_();
    _bcDailyCount++;
    _bcSaveDaily_();
  }
  function _bcUnlockDaily_() {
    _bcCheckDailyReset_();
    _bcDailyUnlocked = true;
    _bcSaveDaily_();
    renderBroadcastList_();
  }

  // ── 4 KICH BAN AI (luu rieng tung may, theo campId) ──
  function _bcSaveVariants_(campId, arr) {
    if (arr && arr.length) _bcVariants[campId] = arr; else delete _bcVariants[campId];
    chrome.storage.local.set({ ome_bc_variants: _bcVariants });
  }
  // Chon kich ban theo vong luan phien dua tren so thu tu da gui (0,1,2,3,0,1,...)
  function _bcPickVariantMsg_(camp, sentSoFar) {
    const arr = _bcVariants[camp.id];
    if (arr && arr.length) return { text: arr[sentSoFar % arr.length], variantNo: (sentSoFar % arr.length) + 1 };
    return { text: camp.message || '', variantNo: 0 };
  }

  function bcLog_(msg) {
    const ts = new Date().toLocaleTimeString('vi-VN');
    _bcLog.unshift('[' + ts + '] ' + msg);
    _bcLog = _bcLog.slice(0, 60);
    const el = document.getElementById('zai-bc-log');
    if (el) el.innerHTML = _bcLog.map(l => escHtml(l)).join('<br>');
    console.log('[OME Broadcast] ' + msg);
  }

  async function markBroadcastServer_(id, phone, status) {
    if (!GAS_URL) return;
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'broadcastMark', id, phone, status }),
        redirect: 'follow'
      });
    } catch (e) {}
  }

  async function loadBroadcastQueue_() {
    if (!GAS_URL) return;
    const box = document.getElementById('zai-bc-body');
    if (box && !_bcRunning) box.innerHTML = '<div style="font-size:11px;color:#6b7280">Đang tải...</div>';
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=broadcastQueue&cs=' + encodeURIComponent(_currentCS || ''), { redirect: 'follow' });
      const d = await r.json();
      _bcQueue = d.broadcasts || [];
      renderBroadcastList_();
    } catch (e) {
      if (box) box.innerHTML = '<div class="zai-error" style="display:block">Lỗi tải danh sách chiến dịch: ' + escHtml(e.message) + '</div>';
    }
  }

  function _bcToggleHide_(id, hide) {
    if (hide) _bcHidden[id] = true; else delete _bcHidden[id];
    chrome.storage.local.set({ ome_bc_hidden: _bcHidden });
    renderBroadcastList_();
  }

  // Kich hoat/tat chien dich CHI TREN MAY NAY (moi CS tu bat cho minh, khong anh huong nguoi khac)
  function _bcToggleActive_(campId, on) {
    if (on) _bcActive[campId] = true; else delete _bcActive[campId];
    chrome.storage.local.set({ ome_bc_active: _bcActive });
    renderBroadcastList_();
  }

  function _bcCampVisible_(camp) {
    if (!!_bcHidden[camp.id] !== _bcShowHidden) return false;
    if (_bcSearch && !(camp.label || camp.id).toLowerCase().includes(_bcSearch.toLowerCase())) return false;
    const cd = camp.createdAt ? String(camp.createdAt).slice(0, 10) : '';
    if (_bcDateFrom && cd && cd < _bcDateFrom) return false;
    if (_bcDateTo && cd && cd > _bcDateTo) return false;
    return true;
  }

  const VARIANT_DELIM = '@@@KB@@@';

  // ── Mo khung LON de xem/sua noi dung mot o textarea cho de doc (dong la ap dung vao o goc) ──
  function openZoomModal_(textareaEl, opts) {
    opts = opts || {};
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:10px;padding:14px;width:min(560px,92vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3);';
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
    const hdrTitle = document.createElement('span');
    hdrTitle.style.cssText = 'font-weight:700;font-size:13px;color:#111827';
    hdrTitle.textContent = opts.title || 'Xem nội dung';
    const closeX = document.createElement('button');
    closeX.textContent = '✕';
    closeX.style.cssText = 'border:none;background:none;font-size:16px;cursor:pointer;color:#6b7280;line-height:1;padding:2px 4px;';
    hdr.appendChild(hdrTitle); hdr.appendChild(closeX);
    box.appendChild(hdr);

    const readOnly = !!textareaEl.readOnly || !!textareaEl.disabled;
    const bigTa = document.createElement('textarea');
    bigTa.value = textareaEl.value;
    bigTa.readOnly = readOnly;
    bigTa.style.cssText = 'flex:1;width:100%;box-sizing:border-box;font-size:15px;line-height:1.55;padding:12px;border:1px solid #d1d5db;border-radius:8px;resize:vertical;min-height:260px;font-family:inherit;';
    box.appendChild(bigTa);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:10px;';
    const doneBtn = document.createElement('button');
    doneBtn.className = 'zai-btn zai-btn-primary zai-btn-sm';
    doneBtn.textContent = readOnly ? 'Đóng' : '✓ Xong, áp dụng & đóng';
    footer.appendChild(doneBtn);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    bigTa.focus();

    function close_(apply) {
      if (apply && !readOnly) {
        textareaEl.value = bigTa.value;
        textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
    function escHandler(e) { if (e.key === 'Escape') close_(false); }
    document.addEventListener('keydown', escHandler);
    closeX.addEventListener('click', () => close_(false));
    doneBtn.addEventListener('click', () => close_(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close_(false); });
  }

  // Them nut "⛶ Phóng to" ngay duoi 1 textarea, mo khung lon cho de doc/sua roi dong lai
  function attachExpandBtn_(parent, textareaEl, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
    btn.textContent = '⛶ Phóng to';
    btn.title = 'Mở khung lớn để xem/sửa cho dễ, đọc xong bấm Đóng';
    btn.style.cssText = 'margin-top:3px;display:inline-block;';
    btn.addEventListener('click', (e) => { e.preventDefault(); openZoomModal_(textareaEl, { title: title }); });
    parent.appendChild(btn);
    return btn;
  }

  // Goi AI (Grok, qua GAS) de sinh 3 kich ban THEM (ngoai kich ban goc), chi doi cau chu rat it.
  // CS BAT BUOC phai xem/sua/duyet truoc khi luu — ham nay chi tao BAN NHAP.
  async function doGenerateVariants_(camp, coreText, container) {
    if (!GAS_URL) { alert('Chưa cài đặt URL GAS.'); return; }
    const text = (coreText || '').trim();
    if (!text) { alert('Nhập nội dung kịch bản gốc cần gửi trước đã.'); return; }
    const btn = container.querySelector('.zai-kb-gen-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'AI đang soạn 3 kịch bản...'; }
    try {
      const prompt = '[Kịch bản gốc — đây là tin nhắn Zalo nhắn hỏi thăm khách ĐÃ MUA hàng, KHÔNG phải kịch bản gọi điện, KHÔNG phải lời chào mời/giới thiệu sản phẩm mới]\n' +
        text +
        '\n\nHãy viết lại thành đúng 3 phiên bản KHÁC của CHÍNH tin nhắn trên.\n' +
        'QUY TẮC BẮT BUỘC — chỉ được thay đổi RẤT ÍT:\n' +
        '- Giữ nguyên 100% nội dung, ý, câu hỏi, số liệu (nếu có) và giọng điệu thân mật, xưng hô như bản gốc.\n' +
        '- Chỉ được đổi một vài từ/cách diễn đạt tương đương nghĩa (ví dụ: "được khoảng 10 ngày rồi" ⇄ "mấy hôm rồi"; "Có cần em hỗ trợ thêm gì không chị?" ⇄ "chị cần em hỗ trợ gì nhắn em tư vấn thêm nhé ạ").\n' +
        '- TUYỆT ĐỐI KHÔNG: thêm ý mới, bớt ý, đổi cấu trúc câu hỏi, đổi thành văn phong trang trọng/khác thể loại, tự xưng "nhân viên CSKH", nhắc tới gọi điện, giới thiệu sản phẩm mới, hay chương trình ưu đãi nếu bản gốc không có.\n' +
        '- Độ dài từng phiên bản xấp xỉ bản gốc.\n' +
        'Trả về đúng 3 phiên bản, phân cách bằng dòng riêng chứa duy nhất "' + VARIANT_DELIM + '", không đánh số, không ghi chú gì thêm.';
      const data = await _aiCall_(prompt);
      if (data.error) throw new Error(data.error);
      let parts = (data.text || '').split(VARIANT_DELIM).map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) parts = (data.text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean); // fallback neu AI khong theo dung dinh dang
      parts = parts.slice(0, 3);
      if (!parts.length) throw new Error('AI không trả về kịch bản nào, thử lại.');
      _bcVariantDraft[camp.id] = parts;
      renderVariantEditor_(camp, container);
    } catch (e) {
      alert('Lỗi tạo kịch bản: ' + e.message);
    } finally {
      const b = container.querySelector('.zai-kb-gen-btn');
      if (b) { b.disabled = false; b.textContent = '✨ Tạo 3 kịch bản AI'; }
    }
  }

  // Ve khung soan/duyet kich ban cho 1 chien dich: Kich ban 1 LUON la ban goc (CS go/sua truc tiep),
  // Kich ban 2-4 la AI sinh THEM (chi doi cau chu rat it so voi goc). CS xem/sua/duyet truoc khi luu —
  // chi kich ban da tich moi duoc dua vao vong luan phien khi gui.
  function renderVariantEditor_(camp, container) {
    container.innerHTML = '';
    const saved = _bcVariants[camp.id] || [];
    // saved[0] la kich ban goc da luu lan truoc (neu co), con lai la cac ban AI da duyet
    const savedCore = saved.length ? saved[0] : (camp.message || '');
    const savedAi = saved.length > 1 ? saved.slice(1) : [];
    const aiDraft = _bcVariantDraft[camp.id] || savedAi;

    addEl(container, 'div', { style: 'font-size:10px;color:#6b7280;margin:6px 0 4px', textContent: 'Kịch bản gốc (kịch bản 1 — dùng làm gốc để AI viết lại, chỉ nên sửa rất ít):' });
    const coreRow = addEl(container, 'div', { style: 'display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;' });
    const coreCb = addEl(coreRow, 'input', { type: 'checkbox' });
    coreCb.checked = true; coreCb.style.marginTop = '6px';
    const coreCol = addEl(coreRow, 'div', { style: 'flex:1;min-width:0' });
    const coreTa = addEl(coreCol, 'textarea', { rows: 3 });
    coreTa.style.cssText = 'width:100%;box-sizing:border-box;font-size:11px;padding:6px;border:1px solid #d1d5db;border-radius:5px;resize:vertical;font-family:inherit;';
    coreTa.value = savedCore;
    attachExpandBtn_(coreCol, coreTa, 'Kịch bản 1 (gốc) — ' + (camp.label || camp.id));

    const genBtn = addEl(container, 'button', { className: 'zai-btn zai-btn-secondary zai-btn-sm zai-kb-gen-btn', textContent: '✨ Tạo 3 kịch bản AI' });
    genBtn.title = 'AI viết lại kịch bản gốc ở trên thành 3 bản khác, chỉ đổi câu chữ rất ít';
    genBtn.style.cssText = 'margin-bottom:6px;';
    genBtn.addEventListener('click', () => doGenerateVariants_(camp, coreTa.value, container));

    const listWrap = addEl(container, 'div', {});
    aiDraft.forEach((v, i) => {
      const row = addEl(listWrap, 'div', { style: 'display:flex;gap:6px;align-items:flex-start;margin-bottom:5px;' });
      const cb = addEl(row, 'input', { type: 'checkbox' });
      cb.checked = true; cb.style.marginTop = '6px';
      const col = addEl(row, 'div', { style: 'flex:1;min-width:0' });
      addEl(col, 'div', { style: 'font-size:10px;color:#15803d;font-weight:700;margin-bottom:2px', textContent: 'Kịch bản ' + (i + 2) + ' (AI, chỉ khác câu chữ)' });
      const ta = addEl(col, 'textarea', { rows: 3 });
      ta.style.cssText = 'width:100%;box-sizing:border-box;font-size:11px;padding:6px;border:1px solid #d1d5db;border-radius:5px;resize:vertical;font-family:inherit';
      ta.value = v;
      attachExpandBtn_(col, ta, 'Kịch bản ' + (i + 2) + ' — ' + (camp.label || camp.id));
      row.dataset.idx = i;
    });

    const btnRow2 = addEl(container, 'div', { style: 'display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;' });
    const saveBtn = addEl(btnRow2, 'button', { className: 'zai-btn zai-btn-primary zai-btn-sm', textContent: '💾 Lưu kịch bản đã duyệt' });
    saveBtn.addEventListener('click', () => {
      const approved = [];
      if (coreCb.checked && coreTa.value.trim()) approved.push(coreTa.value.trim());
      [...listWrap.children].forEach(r => {
        if (r.querySelector('input[type="checkbox"]').checked) {
          const v = r.querySelector('textarea').value.trim();
          if (v) approved.push(v);
        }
      });
      if (!approved.length) { alert('Chưa chọn kịch bản nào để lưu.'); return; }
      _bcSaveVariants_(camp.id, approved);
      delete _bcVariantDraft[camp.id];
      _bcVariantOpenId = '';
      renderBroadcastList_();
    });
    const clearBtn = addEl(btnRow2, 'button', { className: 'zai-btn zai-btn-ghost zai-btn-sm', textContent: '🗑 Bỏ kịch bản, dùng 1 tin gốc' });
    clearBtn.addEventListener('click', () => {
      if (!window.confirm('Bỏ hết kịch bản đã lưu cho chiến dịch này? Sẽ quay lại gửi 1 nội dung gốc cho mọi khách.')) return;
      _bcSaveVariants_(camp.id, null);
      delete _bcVariantDraft[camp.id];
      _bcVariantOpenId = '';
      renderBroadcastList_();
    });
    const closeBtn = addEl(btnRow2, 'button', { className: 'zai-btn zai-btn-ghost zai-btn-sm', textContent: 'Đóng' });
    closeBtn.addEventListener('click', () => { delete _bcVariantDraft[camp.id]; _bcVariantOpenId = ''; renderBroadcastList_(); });
  }

  function renderBroadcastList_() {
    const box = document.getElementById('zai-bc-body');
    if (!box) return;
    box.innerHTML = '';

    // ── Bang dem 200 khach/ngay (rieng may nay) ──
    _bcCheckDailyReset_();
    const locked = _bcDailyLocked_();
    const dailyBox = document.createElement('div');
    dailyBox.style.cssText = 'border-radius:6px;padding:6px 8px;margin-bottom:8px;font-size:11px;' +
      (locked ? 'background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;' : 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;');
    dailyBox.innerHTML = '<div>📊 Hôm nay: <b>' + _bcDailyCount + '/' + BC_DAILY_LIMIT + '</b> khách đã gửi (tính chung mọi chiến dịch, trên máy này)</div>' +
      (locked ? '<div style="margin-top:3px">⚠️ Đã đạt ' + BC_DAILY_LIMIT + ' khách hôm nay — chiến dịch tạm ngưng. Bấm nút bên dưới nếu vẫn muốn gửi tiếp.</div>' : '');
    box.appendChild(dailyBox);
    if (locked) {
      const unlockBtn = document.createElement('button');
      unlockBtn.className = 'zai-btn zai-btn-secondary zai-btn-sm';
      unlockBtn.textContent = '🔓 Kích hoạt lại để gửi tiếp hôm nay';
      unlockBtn.style.marginBottom = '8px';
      unlockBtn.addEventListener('click', () => {
        if (window.confirm('Đã gửi ' + _bcDailyCount + ' khách hôm nay (vượt mốc ' + BC_DAILY_LIMIT + '). Vẫn muốn tiếp tục gửi thêm?')) _bcUnlockDaily_();
      });
      box.appendChild(unlockBtn);
    }

    // ── Banner CANH BAO khi co chien dich dang chay/tam dung (giai thich vi sao nut "Bat dau" khac bi mo/disable) ──
    if (_bcRunning) {
      const runningCamp = _bcQueue.find(c => c.id === _bcRunningCampId);
      const runBox = document.createElement('div');
      runBox.style.cssText = 'border-radius:6px;padding:6px 8px;margin-bottom:8px;font-size:11px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;';
      runBox.innerHTML = '<div>⚡ ' + (_bcPaused ? 'ĐANG TẠM DỪNG' : 'ĐANG CHẠY') + ' chiến dịch "' +
        escHtml((runningCamp && (runningCamp.label || runningCamp.id)) || _bcRunningCampId || '?') +
        '" — các chiến dịch khác không bấm "Bắt đầu" được cho tới khi chiến dịch này Dừng hẳn.</div>';
      const forceResetBtn = document.createElement('button');
      forceResetBtn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
      forceResetBtn.style.marginTop = '4px';
      forceResetBtn.textContent = '🔄 Bị kẹt? Buộc dừng & đặt lại';
      forceResetBtn.addEventListener('click', () => {
        if (window.confirm('Buộc dừng chiến dịch đang chạy và đặt lại trạng thái? Chỉ dùng khi nút "Bắt đầu" bị kẹt không bấm được.')) {
          _bcStopFlag = true;
          _bcPaused = false;
          _bcRunning = false;
          _bcRunningCampId = '';
          bcLog_('🔄 Đã buộc đặt lại trạng thái thủ công.');
          renderBroadcastList_();
        }
      });
      runBox.appendChild(forceResetBtn);
      box.appendChild(runBox);
    }

    // Toggle: co kiem tra khop Nick Zalo truoc khi gui khong
    const nickRow = document.createElement('label');
    nickRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#166534;margin-bottom:6px;cursor:pointer;';
    nickRow.innerHTML = '<input type="checkbox" id="zai-bc-checknick" style="margin:0"> Kiểm tra khớp Nick Zalo trước khi gửi (bật khi đã đồng bộ Nick theo khách)';
    box.appendChild(nickRow);
    const checknickEl = nickRow.querySelector('#zai-bc-checknick');
    checknickEl.checked = _bcCheckNick;
    checknickEl.addEventListener('change', () => { _bcCheckNick = checknickEl.checked; });

    // Bo loc: tim ten + khoang ngay tao
    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center;';
    filterRow.innerHTML =
      '<input id="zai-bc-search" type="text" placeholder="🔍 Tìm tên chiến dịch..." value="' + escHtml(_bcSearch) + '" style="flex:1;min-width:120px;padding:4px 8px;border:1px solid #d1d5db;border-radius:5px;font-size:11px;">' +
      '<input id="zai-bc-from" type="date" value="' + _bcDateFrom + '" title="Từ ngày" style="padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-size:10px;width:105px;">' +
      '<input id="zai-bc-to" type="date" value="' + _bcDateTo + '" title="Đến ngày" style="padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-size:10px;width:105px;">';
    box.appendChild(filterRow);
    filterRow.querySelector('#zai-bc-search').addEventListener('input', (e) => { _bcSearch = e.target.value; renderBroadcastList_(); setTimeout(() => { const el = document.getElementById('zai-bc-search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); });
    filterRow.querySelector('#zai-bc-from').addEventListener('change', (e) => { _bcDateFrom = e.target.value; renderBroadcastList_(); });
    filterRow.querySelector('#zai-bc-to').addEventListener('change', (e) => { _bcDateTo = e.target.value; renderBroadcastList_(); });

    // Danh sach chien dich — khung CUON
    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'max-height:240px;overflow-y:auto;padding-right:2px;';
    const visible = _bcQueue.filter(_bcCampVisible_);
    if (!visible.length) {
      listWrap.innerHTML = '<div style="font-size:11px;color:#6b7280;padding:6px 0">' + (_bcShowHidden ? 'Không có chiến dịch nào đã ẩn.' : 'Không có chiến dịch nào đang chờ gửi (khớp bộ lọc).') + '</div>';
    } else {
      visible.forEach(camp => {
        const serverOff = (camp.status || 'active') === 'paused'; // admin tat tu Sasum -> khoa voi moi nguoi
        const isActive = !serverOff && !!_bcActive[camp.id];      // kich hoat rieng tren may nay
        const isRunningThis = _bcRunning && _bcRunningCampId === camp.id;
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border:1px solid ' + (isActive ? '#bbf7d0' : '#e5e7eb') + ';border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:12px;' + (isActive ? '' : 'opacity:.75;');
        const dateStr = camp.createdAt ? new Date(camp.createdAt).toLocaleDateString('vi-VN') : '';
        const badge = serverOff ? 'ADMIN ĐÃ TẮT' : (isActive ? 'ĐANG KÍCH HOẠT' : 'CHƯA KÍCH HOẠT');
        const badgeCss = serverOff ? 'background:#fef2f2;color:#dc2626' : (isActive ? 'background:#dcfce7;color:#15803d' : 'background:#f3f4f6;color:#6b7280');
        card.innerHTML =
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
            '<span style="font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(camp.label || camp.id) + '</span>' +
            '<span style="font-size:9px;font-weight:700;border-radius:10px;padding:1px 7px;' + badgeCss + '">' + badge + '</span>' +
          '</div>' +
          '<div style="color:#6b7280;font-size:11px;margin-bottom:6px">Còn ' + camp.pendingPhones.length + '/' + camp.total + ' khách chưa gửi &middot; ' + (camp.images || []).length + ' ảnh' + (dateStr ? ' &middot; tạo ' + dateStr : '') + '</div>';
        const varCount = (_bcVariants[camp.id] || []).length;
        if (varCount) {
          const vb = document.createElement('div');
          vb.style.cssText = 'font-size:10px;color:#15803d;margin:-3px 0 6px;';
          vb.textContent = '🔀 Đang luân phiên ' + varCount + ' kịch bản đã duyệt';
          card.appendChild(vb);
        }
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;';

        if (isRunningThis) {
          const pauseBtn = document.createElement('button');
          pauseBtn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
          pauseBtn.textContent = _bcPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
          pauseBtn.addEventListener('click', () => {
            _bcPaused = !_bcPaused;
            pauseBtn.textContent = _bcPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
            bcLog_(_bcPaused ? 'Đã tạm dừng.' : 'Tiếp tục gửi.');
          });
          const stopBtn = document.createElement('button');
          stopBtn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
          stopBtn.textContent = '⏹ Dừng hẳn';
          stopBtn.addEventListener('click', () => { _bcStopFlag = true; bcLog_('Đã yêu cầu dừng — sẽ dừng sau khách hiện tại.'); });
          btnRow.appendChild(pauseBtn);
          btnRow.appendChild(stopBtn);
        } else {
          const startBtn = document.createElement('button');
          startBtn.className = 'zai-btn zai-btn-primary zai-btn-sm';
          startBtn.textContent = '▶ Bắt đầu';
          startBtn.disabled = _bcRunning || !isActive || locked;
          startBtn.title = serverOff ? 'Admin đã tắt chiến dịch này trên Sasum' : (!isActive ? 'Bấm "⏻ Kích hoạt" trước — chỉ áp dụng trên máy của bạn' : (locked ? 'Đã đạt ' + BC_DAILY_LIMIT + ' khách hôm nay — bấm "🔓 Kích hoạt lại" ở trên trước' : (_bcRunning ? 'Đang có chiến dịch khác chạy' : '')));
          startBtn.addEventListener('click', () => startBroadcast_(camp));
          btnRow.appendChild(startBtn);
        }

        const togBtn = document.createElement('button');
        togBtn.className = 'zai-btn zai-btn-secondary zai-btn-sm';
        togBtn.textContent = _bcActive[camp.id] ? '⏻ Tắt' : '⏻ Kích hoạt';
        togBtn.title = 'Chỉ áp dụng trên máy này — CS nào kích hoạt thì máy đó mới chạy được';
        togBtn.disabled = isRunningThis || serverOff;
        togBtn.addEventListener('click', () => _bcToggleActive_(camp.id, !_bcActive[camp.id]));
        btnRow.appendChild(togBtn);

        const hideBtn = document.createElement('button');
        hideBtn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
        hideBtn.textContent = _bcShowHidden ? '👁 Bỏ ẩn' : '🙈 Ẩn';
        hideBtn.disabled = isRunningThis;
        hideBtn.addEventListener('click', () => _bcToggleHide_(camp.id, !_bcShowHidden));
        btnRow.appendChild(hideBtn);

        const kbBtn = document.createElement('button');
        kbBtn.className = 'zai-btn zai-btn-ghost zai-btn-sm';
        kbBtn.textContent = _bcVariantOpenId === camp.id ? '✕ Đóng kịch bản' : '🤖 Kịch bản';
        kbBtn.title = '1 kịch bản gốc + 3 kịch bản AI (chỉ khác câu chữ rất ít) để luân phiên gửi';
        kbBtn.disabled = isRunningThis;
        kbBtn.addEventListener('click', () => {
          _bcVariantOpenId = (_bcVariantOpenId === camp.id) ? '' : camp.id;
          renderBroadcastList_();
        });
        btnRow.appendChild(kbBtn);

        card.appendChild(btnRow);

        if (_bcVariantOpenId === camp.id) {
          const kbContainer = document.createElement('div');
          kbContainer.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px dashed #d1d5db;';
          card.appendChild(kbContainer);
          renderVariantEditor_(camp, kbContainer);
        }

        listWrap.appendChild(card);
      });
    }
    box.appendChild(listWrap);

    // Link xem/an danh sach da an
    const hiddenCount = _bcQueue.filter(c => _bcHidden[c.id]).length;
    if (hiddenCount || _bcShowHidden) {
      const hl = document.createElement('a');
      hl.href = '#';
      hl.style.cssText = 'display:block;font-size:10px;color:#6b7280;text-decoration:underline;margin-top:2px;';
      hl.textContent = _bcShowHidden ? '← Quay lại danh sách chính' : ('Xem ' + hiddenCount + ' chiến dịch đã ẩn');
      hl.addEventListener('click', (e) => { e.preventDefault(); _bcShowHidden = !_bcShowHidden; renderBroadcastList_(); });
      box.appendChild(hl);
    }

    // Trang thai + log — hien khi dang chay
    const ctrl = document.createElement('div');
    ctrl.id = 'zai-bc-ctrl';
    ctrl.style.cssText = 'margin-top:6px;display:' + (_bcRunning ? 'block' : 'none') + ';';
    ctrl.innerHTML =
      '<div id="zai-bc-status" style="font-size:11px;color:#166534;margin-bottom:4px;"></div>' +
      '<div id="zai-bc-log" style="font-size:10px;color:#6b7280;max-height:120px;overflow-y:auto;background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:5px;"></div>';
    box.appendChild(ctrl);
  }

  // Tim va mo doan chat cua 1 SDT bang cach go vao o tim kiem cua Zalo
  async function openZaloChatByPhone_(phone) {
    const SEARCH_SELS = [
      'input[placeholder*="Tìm kiếm"]',
      'input[placeholder*="Tìm"]',
      '[class*="search-box"] input',
      '[class*="search"] input[type="text"]',
      'input[class*="search"]',
    ];
    let searchEl = null;
    for (const sel of SEARCH_SELS) {
      try { const el = document.querySelector(sel); if (el) { searchEl = el; break; } } catch (e) {}
    }
    if (!searchEl) { bcLog_('⏭ Không tìm thấy ô tìm kiếm Zalo — bỏ qua: ' + phone); return false; }

    // Tim bang 9 SO CUOI (bo so 0 dau) — Zalo khop ca so luu 84xxx / 0xxx
    const q9 = phone.slice(-9);
    searchEl.focus();
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(searchEl, q9);
    } catch (e) { searchEl.value = q9; }
    searchEl.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep_(1200);

    const RESULT_SELS = [
      '[class*="search-result"] [class*="item"]',
      '[class*="searchResult"] [class*="item"]',
      '[class*="result-list"] [class*="item"]',
      '[class*="contact-item"]',
      '[class*="result"] [class*="item"]',
    ];
    let target = null;
    for (const sel of RESULT_SELS) {
      try {
        const items = [...document.querySelectorAll(sel)];
        // Khop theo CHU SO trong ket qua (bo khoang trang/dinh dang): chua 9 so cuoi la trung
        target = items.find(it => ((it.textContent || '').replace(/\D/g, '')).includes(q9));
        if (target) break;
      } catch (e) {}
    }
    if (!target) { bcLog_('⏭ Không tìm thấy — bỏ qua: ' + phone); return false; }

    target.click();
    await sleep_(1200);

    for (let i = 0; i < 8; i++) {
      const name = getCurrentChatName();
      if (name) {
        const nd = name.replace(/\D/g, '');
        if (extractPhone(name) === phone || nd.includes(q9)) return true;
      }
      await sleep_(400);
    }
    bcLog_('⚠️ Đã mở chat nhưng chưa xác nhận khớp đúng khách: ' + phone + ' (vẫn thử gửi)');
    return true;
  }

  function findZaloComposeInput_() {
    const INPUT_SELS = [
      '[class*="chat-input"] [contenteditable]',
      '[class*="message-input"] [contenteditable]',
      '[class*="input-box"] [contenteditable]',
      '[class*="input-area"] [contenteditable]',
      '[class*="editor"] [contenteditable]',
      '[contenteditable="true"]',
    ];
    for (const sel of INPUT_SELS) {
      try {
        const els = [...document.querySelectorAll(sel)];
        const el = els.find(e => { const r = e.getBoundingClientRect(); return r.height > 20 && r.height < 300 && r.width > 100; });
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function insertZaloText_(inputEl, text) {
    if (!text || !text.trim()) return;
    inputEl.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, text);
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }

  async function fetchAsFile_(url, filename) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  }

  // Gan anh vao input file an cua Zalo bang DataTransfer (khong the set input.files truc tiep)
  async function attachZaloImages_(imageUrls) {
    const FILE_INPUT_SELS = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ];
    let fileInput = null;
    for (const sel of FILE_INPUT_SELS) {
      try { const el = document.querySelector(sel); if (el) { fileInput = el; break; } } catch (e) {}
    }
    if (!fileInput) { bcLog_('❌ Không tìm thấy input đính kèm ảnh của Zalo'); return false; }

    const files = [];
    for (let i = 0; i < imageUrls.length; i++) {
      try { files.push(await fetchAsFile_(imageUrls[i], 'img_' + i + '.jpg')); }
      catch (e) { bcLog_('⚠️ Lỗi tải ảnh ' + (i + 1) + ': ' + e.message); }
    }
    if (!files.length) return false;

    try {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep_(1200);
      return true;
    } catch (e) {
      bcLog_('❌ Lỗi gắn ảnh: ' + e.message);
      return false;
    }
  }

  function clickZaloSendOrEnter_(inputEl) {
    const SEND_SELS = ['button[class*="send"]', '[class*="btn-send"]', '[class*="sendBtn"]', '[class*="send-btn"]', '[class*="icon-send"]'];
    for (const s of SEND_SELS) {
      try { const b = document.querySelector(s); if (b) { b.click(); return true; } } catch (e) {}
    }
    if (inputEl) {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      return true;
    }
    return false;
  }

  // ── TU DONG CAP NHAT TINH TRANG KET BAN ZALO VE SASUM ──
  // Quy uoc doc tu giao dien chat dang mo:
  //  - Co nut/banner "Gửi kết bạn" / "Gửi yêu cầu kết bạn"  -> Chưa kết bạn
  //  - Co "Đã gửi lời mời/yêu cầu" / "Hủy yêu cầu" / "Thu hồi" -> Chưa đồng ý (da gui, cho chap nhan)
  //  - Ten khach co chu CTN -> Chặn (da ket ban nhung chan tin nhan)
  //  - Ten khach co chu NHD -> Zalo ngừng hd (tai khoan ngung hoat dong)
  //  - Khong thay gi -> Đã kết bạn
  function detectZaloFriendStatus_() {
    const name = getCurrentChatName() || '';
    if (/\bNHD\b/i.test(name)) return 'Zalo ngừng hd';
    if (/\bCTN\b/i.test(name)) return 'Chặn';
    let sawSend = false, sawPending = false;
    try {
      const els = document.querySelectorAll('button, a, span, div');
      for (const el of els) {
        if (el.children && el.children.length > 0) continue;
        const t = (el.textContent || '').trim();
        if (!t || t.length > 70) continue;
        const tl = t.toLowerCase();
        if (/hủy yêu cầu|đã gửi (lời mời|yêu cầu)|thu hồi lời mời/.test(tl)) { sawPending = true; break; }
        if (/^gửi kết bạn$|gửi yêu cầu kết bạn/.test(tl)) sawSend = true;
      }
    } catch (e) {}
    if (sawPending) return 'Chưa đồng ý';
    if (sawSend) return 'Chưa kết bạn';
    return 'Đã kết bạn';
  }

  // Cap nhat len Sasum (chi ghi khi khac gia tri hien tai -> khach da update roi thi tu bo qua)
  async function autoUpdateZaloStatus_(phone) {
    if (!GAS_URL || !phone) return;
    try {
      const st = detectZaloFriendStatus_();
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=lookup&phone=' + encodeURIComponent(phone), { redirect: 'follow' });
      const d = await r.json();
      const care = (d && d.care) || null;
      if (care && (care.zalo || '') === st) return; // da dung trang thai nay roi -> bo qua
      // FIX: dung action ghi hep 'syncZaloFriendStatus' thay vi 'saveSingle' — tranh ghi de
      // status/cs/note/schedules cua khach bang du lieu lookup co the da cu tai thoi diem ghi.
      await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncZaloFriendStatus', rows: [{ phone: phone, zalo: st, scannedBy: _currentCS || '', nick: _currentZaloNick || '' }] }),
        headers: { 'Content-Type': 'text/plain' }
      });
      bcLog_('🔗 Cập nhật Zalo "' + st + '" → Sasum: ' + phone);
    } catch (e) {}
  }

  async function startBroadcast_(camp) {
    if (_bcRunning) { bcLog_('Đang có chiến dịch chạy, vui lòng dừng trước khi bắt đầu chiến dịch khác.'); return; }
    if ((camp.status || 'active') === 'paused') { alert('Chiến dịch "' + (camp.label || camp.id) + '" đã bị Admin tắt trên Sasum.'); return; }
    if (!_bcActive[camp.id]) { alert('Chiến dịch "' + (camp.label || camp.id) + '" chưa được kích hoạt trên máy này. Bấm "⏻ Kích hoạt" trước khi gửi.'); return; }
    if (_bcDailyLocked_()) { alert('Đã đạt ' + BC_DAILY_LIMIT + ' khách hôm nay trên máy này. Bấm "🔓 Kích hoạt lại để gửi tiếp hôm nay" ở phía trên trước khi bắt đầu.'); return; }

    // Kiem tra khop Nick Zalo (chi khi nguoi dung bat tuy chon nay)
    if (_bcCheckNick) {
      if (camp.expectedNick) {
        if (_currentZaloNick !== camp.expectedNick) {
          alert('⚠️ Nick Zalo đang dùng ("' + (_currentZaloNick || '(chưa chọn)') +
            '") KHÔNG khớp với Nick phụ trách của chiến dịch "' + (camp.label || camp.id) + '" ("' + camp.expectedNick +
            '"). Vui lòng chuyển đúng Nick Zalo (ở thanh 💬 Nick phía trên) rồi thử lại.');
          return;
        }
      } else {
        if (!window.confirm('Chiến dịch "' + (camp.label || camp.id) + '" chưa có dữ liệu Nick Zalo để so khớp (chưa đồng bộ). Vẫn tiếp tục gửi?')) return;
      }
    }

    const varCount = (_bcVariants[camp.id] || []).length;
    const remainToday = Math.max(0, BC_DAILY_LIMIT - _bcDailyCount);
    const confirmMsg = 'Sẽ TỰ ĐỘNG gửi tin + ' + (camp.images || []).length + ' ảnh cho ' +
      camp.pendingPhones.length + ' khách trong chiến dịch "' + (camp.label || camp.id) +
      '".\n' + (varCount ? ('Sẽ luân phiên ' + varCount + ' kịch bản đã duyệt.\n') : '') +
      'Còn được gửi ' + remainToday + '/' + BC_DAILY_LIMIT + ' khách hôm nay trên máy này (đạt mốc sẽ tự dừng).' +
      '\n\nExtension sẽ tự mở từng đoạn chat và gửi, có nghỉ giữa các khách để tránh bị Zalo hạn chế. ' +
      'Bạn có thể Tạm dừng / Dừng hẳn bất cứ lúc nào.\n\nTiếp tục?';
    if (!window.confirm(confirmMsg)) return;

    if (!_currentCS) { alert('Chưa chọn CS ở thanh 👤 CS phía trên. Chọn đúng tên CS của bạn rồi mới bắn được.'); return; }

    _bcRunning = true; _bcPaused = false; _bcStopFlag = false;
    _bcRunningCampId = camp.id;
    _bcLog = [];
    renderBroadcastList_();
    bcLog_('Bắt đầu chiến dịch "' + (camp.label || camp.id) + '" — ' + camp.pendingPhones.length + ' khách.');

    let sentCount = 0, failCount = 0, skipCount = 0;
    const total = camp.pendingPhones.length;

    let dailyCapHit = false;

    // BOC try/finally QUANH TOAN BO VONG LAP: neu co loi bat ngo (ngoai du kien) xay ra,
    // _bcRunning VAN duoc dua ve false o cuoi cung — tranh ket cung "Bat dau" mai mai
    // khien cac chien dich khac khong the bam nut chay duoc nua.
    try {
      for (let idx = 0; idx < camp.pendingPhones.length; idx++) {
        if (_bcStopFlag) break;
        while (_bcPaused && !_bcStopFlag) { await sleep_(1000); }
        if (_bcStopFlag) break;

        if (_bcDailyLocked_()) {
          dailyCapHit = true;
          bcLog_('🛑 Đã đạt ' + BC_DAILY_LIMIT + ' khách hôm nay trên máy này — tạm ngưng chiến dịch.');
          break;
        }

        const phone = camp.pendingPhones[idx];
        const statusEl = document.getElementById('zai-bc-status');
        if (statusEl) statusEl.textContent = 'Đang gửi ' + (idx + 1) + '/' + total + ' — ' + phone;

        // BAT BUOC: chi gui khach co CS CHAM SOC = CS dang chon tren Zalo AI
        const custCS = ((camp.perPhoneCS && camp.perPhoneCS[phone]) || '').toLowerCase();
        if (custCS !== _currentCS.toLowerCase()) {
          skipCount++;
          bcLog_('⏭ Bỏ qua (CS chăm sóc: ' + (custCS || 'chưa gán') + '): ' + phone);
          continue;
        }

        // Dinh tuyen theo Nick Zalo: neu khach da co du lieu nick ket ban (tu CareData.nickZalos)
        // va nick dang dung KHONG nam trong do -> bo qua NHUNG KHONG danh dau len server,
        // de CS mo dung nick van gui duoc cho khach nay.
        const custNicks = (camp.perPhoneNick && camp.perPhoneNick[phone]) || [];
        if (_currentZaloNick && Array.isArray(custNicks) && custNicks.length && !custNicks.includes(_currentZaloNick)) {
          skipCount++;
          bcLog_('⏭ Bỏ qua (khách kết bạn nick khác: ' + custNicks.join(', ') + '): ' + phone);
          continue;
        }

        try {
          const opened = await openZaloChatByPhone_(phone);
          if (!opened) {
            // KHONG danh dau len server — nick khac van gui duoc cho khach nay
            skipCount++;
          } else {
            await sleep_(600);
            // Tu dong doc tinh trang ket ban tu giao dien chat -> update ve Sasum (khong chan luong gui)
            autoUpdateZaloStatus_(phone).catch(() => {});
            const inputEl = findZaloComposeInput_();
            if (!inputEl) {
              failCount++;
              bcLog_('❌ Không tìm thấy ô soạn tin cho: ' + phone + ' (sẽ thử lại ở lần chạy sau)');
            } else {
              if (camp.images && camp.images.length) await attachZaloImages_(camp.images);
              let personalMsg, variantNo;
              if (camp.perPhoneMsg && camp.perPhoneMsg[phone]) {
                personalMsg = camp.perPhoneMsg[phone]; variantNo = 0;
              } else {
                const picked = _bcPickVariantMsg_(camp, sentCount);
                personalMsg = picked.text; variantNo = picked.variantNo;
              }
              insertZaloText_(inputEl, personalMsg);
              await sleep_(400);
              clickZaloSendOrEnter_(inputEl);
              sentCount++;
              _bcIncrementDaily_();
              await markBroadcastServer_(camp.id, phone, 'sent');
              bcLog_('✅ Đã gửi' + (variantNo ? ' (kịch bản ' + variantNo + ')' : '') + ': ' + phone + ' — hôm nay ' + _bcDailyCount + '/' + BC_DAILY_LIMIT);
            }
          }
        } catch (e) {
          failCount++;
          bcLog_('❌ Lỗi với ' + phone + ': ' + e.message + ' (sẽ thử lại ở lần chạy sau)');
        }

        if (_bcStopFlag) break;

        const doneSoFar = sentCount + failCount + skipCount;
        if (doneSoFar > 0 && doneSoFar % _bcBatchPauseEvery === 0 && idx < camp.pendingPhones.length - 1) {
          bcLog_('⏳ Nghỉ ' + _bcBatchPauseMin + ' phút sau ' + _bcBatchPauseEvery + ' tin để tránh bị Zalo hạn chế...');
          await sleep_(_bcBatchPauseMin * 60 * 1000);
        } else if (idx < camp.pendingPhones.length - 1) {
          await sleep_(randDelayMs_(_bcDelayMinSec, _bcDelayMaxSec));
        }
      }
    } catch (e) {
      bcLog_('❌ Chiến dịch dừng do lỗi ngoài dự kiến: ' + (e && e.message ? e.message : e));
    } finally {
      // LUON LUON chay du co loi hay khong -> khong bao gio ket _bcRunning=true mai mai
      _bcRunning = false;
      _bcRunningCampId = '';
    }

    const statusEl = document.getElementById('zai-bc-status');
    const summary = 'Hoàn tất: ' + sentCount + ' đã gửi, ' + failCount + ' lỗi, ' + skipCount + ' bỏ qua.' +
      (dailyCapHit ? ' Đã dừng vì đạt ' + BC_DAILY_LIMIT + ' khách/ngày — bấm "🔓 Kích hoạt lại" nếu muốn gửi tiếp.' : '');
    if (statusEl) statusEl.textContent = summary;
    bcLog_('🏁 ' + summary);
    renderBroadcastList_();
    await loadBroadcastQueue_();
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUET DANH BA ZALO — du phong khi khach chua co du lieu trong Sasum.
  //  Doc cac dong text co chua SDT dang hien tren man hinh (danh ba/tin nhan Zalo),
  //  suy ra trang thai KET BAN theo quy uoc:
  //    - Ten co chu NHD                          -> "Zalo ngừng hd"
  //    - Ten co chu CTN                          -> "Chặn"
  //    - Thay "Chưa đồng ý"                      -> "Chưa đồng ý"
  //    - Thay "Gửi kết bạn" / "Gửi yêu cầu kết bạn" -> "Chưa kết bạn"
  //    - Con lai (thay ten hoac chi thay SDT, KHONG co dau hieu tren) -> "Đã kết bạn"
  //      (chi thay SDT khong co nghia la chua ket ban — Zalo van co the hien SDT lam
  //      ten hien thi ngay ca khi da ket ban, vi khach chua dat ten hoac CS chua luu ten rieng)
  //  Ket qua luon duoc CS xem lai va co the sua truoc khi dong bo — khong tu dong gui gi ca.
  // ═══════════════════════════════════════════════════════════════
  // Vùng KHÔNG được quét: khung tin nhắn (chat bubble) + ô soạn tin — SĐT khách gõ trong
  // nội dung chat KHÔNG được tính, chỉ lấy SĐT hiển thị trong danh bạ / tên đã lưu trên Zalo
  // (sidebar danh sách hội thoại, kết quả tìm kiếm, tiêu đề đoạn chat, thẻ thông tin liên hệ).
  function _zaloExcludedContainers_() {
    const sels = [
      '[class*="chat-content"]', '[class*="message-list"]', '[class*="conversation-content"]',
      '[class*="msg-list"]', '[class*="MessageBox"]', '[contenteditable]',
      '[class*="chat-input"]', '[class*="message-input"]', '[class*="input-box"]', '[class*="input-area"]'
    ];
    const out = [];
    sels.forEach(sel => { try { out.push(...document.querySelectorAll(sel)); } catch (e) {} });
    return out;
  }
  function _isInsideExcluded_(el, excluded) {
    for (const ex of excluded) { if (ex.contains(el)) return true; }
    return false;
  }
  function scanZaloFriendStatus_() {
    const RE = /^(.*?)\b(0[3-9]\d{8})\b(.*)$/;
    const excluded = _zaloExcludedContainers_();
    // Gom TẤT CẢ lần khớp cho mỗi SĐT, sau đó chọn kết quả TỐT NHẤT (có dấu hiệu rõ ràng nhất)
    // thay vì chỉ lấy lần gặp đầu tiên trong DOM — tránh bị 1 khớp "trơ SĐT" (không có dấu hiệu gì)
    // đè lên kết quả có dấu hiệu chắc chắn (NHD/CTN/Chưa đồng ý/Gửi kết bạn) xuất hiện ở chỗ khác.
    const byPhone = {};
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (el.children && el.children.length > 0) continue; // chi lay leaf de tranh trung text lap cua the cha
      if (_isInsideExcluded_(el, excluded)) continue; // bỏ qua khung chat + ô soạn tin
      const text = (el.textContent || '').trim();
      if (!text || text.length > 120) continue;
      const m = text.match(RE);
      if (!m) continue;
      const phone = normPhone(m[2]);
      if (!phone) continue;
      const namePart = (m[1] || '').replace(/[,\-–]\s*$/, '').trim();
      let status, score;
      if (/\bNHD\b/i.test(text)) { status = 'Zalo ngừng hd'; score = 3; }
      else if (/\bCTN\b/i.test(text)) { status = 'Chặn'; score = 3; }
      else if (/chưa\s*đồng\s*ý/i.test(text)) { status = 'Chưa đồng ý'; score = 3; }
      else if (/gửi\s*(yêu\s*cầu\s*)?kết\s*bạn/i.test(text)) { status = 'Chưa kết bạn'; score = 3; }
      else { status = 'Đã kết bạn'; score = namePart ? 2 : 1; }
      const cand = { phone, rawName: text, nameGuess: namePart || phone, zaloStatus: status, _score: score };
      const cur = byPhone[phone];
      if (!cur || cand._score > cur._score) byPhone[phone] = cand;
    }
    return Object.values(byPhone).map(r => ({ phone: r.phone, rawName: r.rawName, nameGuess: r.nameGuess, zaloStatus: r.zaloStatus }));
  }

  function renderZsPreview_(rows) {
    const box = document.getElementById('zai-zs-preview');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div style="font-size:11px;color:#6b7280">Không tìm thấy số điện thoại nào trên màn hình hiện tại. Thử cuộn/mở danh bạ rồi quét lại.</div>'; return; }
    box.innerHTML =
      '<div style="font-size:11px;color:#166534;margin-bottom:5px">Tìm thấy ' + rows.length + ' khách — kiểm tra lại trạng thái (có thể sửa) rồi bấm Đồng bộ:</div>' +
      '<div style="max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;background:#fff;">' +
      rows.map((r, i) =>
        '<div style="display:flex;gap:6px;align-items:center;padding:5px 8px;font-size:11px;border-bottom:1px solid #f3f4f6;">' +
          '<input type="checkbox" class="zai-zs-chk" data-i="' + i + '" checked>' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(r.nameGuess) + ' — <b>' + escHtml(r.phone) + '</b></span>' +
          '<button type="button" class="zai-zs-copy" data-i="' + i + '" title="Copy số điện thoại" style="flex:0 0 auto;font-size:11px;padding:2px 6px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;">📋</button>' +
          '<select class="zai-zs-status" data-i="' + i + '" style="font-size:10px;padding:1px 3px;border:1px solid #d1d5db;border-radius:4px;">' +
            ZALO_STATUSES.filter(s => s).map(s => '<option value="' + escHtml(s) + '"' + (s === r.zaloStatus ? ' selected' : '') + '>' + escHtml(s) + '</option>').join('') +
          '</select>' +
        '</div>'
      ).join('') +
      '</div>' +
      '<button class="zai-btn zai-btn-primary zai-btn-sm" id="zai-zs-sync-btn" style="margin-top:6px;width:100%">☁ Đồng bộ trạng thái kết bạn lên Sasum</button>' +
      '<div id="zai-zs-sync-status" style="font-size:11px;color:#00b14f;margin-top:4px"></div>';
    document.getElementById('zai-zs-sync-btn').addEventListener('click', () => syncZsRows_(rows));
    box.querySelectorAll('.zai-zs-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const phone = rows[i] ? rows[i].phone : '';
        if (!phone) return;
        navigator.clipboard.writeText(phone).then(() => {
          const old = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = old; }, 1200);
        }).catch(() => {});
      });
    });
  }

  // Hoi ban GAS dang chay tren URL hien tai (de doi chieu khi loi Unknown action)
  async function _gasDeployedVer_() {
    try {
      const sep = GAS_URL.includes('?') ? '&' : '?';
      const r = await fetch(GAS_URL + sep + 'action=count', { redirect: 'follow' });
      const d = await r.json();
      return (d && d.ver) ? String(d.ver) : '(không rõ)';
    } catch (e) { return '(không kết nối được)'; }
  }

  async function syncZsRows_(rows) {
    if (!GAS_URL) { showError('Chưa cài đặt URL GAS.'); return; }
    const checks = [...document.querySelectorAll('.zai-zs-chk')].filter(c => c.checked);
    let selected = checks.map(c => {
      const i = parseInt(c.dataset.i, 10);
      const selEl = document.querySelector('.zai-zs-status[data-i="' + i + '"]');
      return { phone: rows[i].phone, zalo: selEl ? selEl.value : rows[i].zaloStatus, scannedBy: _currentCS || '', nick: _currentZaloNick || '' };
    });
    if (!selected.length) { showMsg('zai-zs-sync-status', 'Chưa chọn dòng nào.', 2500); return; }
    const btn = document.getElementById('zai-zs-sync-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang kiểm tra...'; }
    try {
      // Buoc 1: dry-run - kiem tra SDT nao dang doi trang thai da duoc CS khac ghi nhan truoc do
      const chkRes = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncZaloFriendStatus', rows: selected, dryRun: true }),
        redirect: 'follow'
      });
      const chkData = await chkRes.json();
      if (!chkData.ok) {
        let em = 'Lỗi: ' + (chkData.error || 'không rõ');
        if (String(chkData.error || '').indexOf('Unknown action') !== -1) {
          const dv = await _gasDeployedVer_();
          em += ' — URL này đang chạy GAS bản ' + dv + '. Vào Apps Script → Deploy → Manage deployments → tìm deployment có URL TRÙNG với URL trong ⚙ của Duyên AI → ✏ → New version → Deploy.';
        }
        showMsg('zai-zs-sync-status', em, 15000); return;
      }

      const conflicts = chkData.conflicts || [];
      if (conflicts.length) {
        const lines = conflicts.map(c =>
          '• ' + c.phone + ': "' + c.oldZalo + '"' + (c.oldCs ? ' (CS ' + c.oldCs + (c.oldNick ? ', nick ' + c.oldNick : '') + ')' : '') +
          ' → sẽ đổi thành "' + c.newZalo + '"'
        ).join('\n');
        const ok = window.confirm(
          '⚠️ ' + conflicts.length + ' SĐT sau đã được CS khác ghi nhận trạng thái Zalo khác:\n\n' + lines +
          '\n\nBạn có muốn GHI ĐÈ trạng thái mới cho các SĐT này không?\n' +
          '(Bấm Hủy sẽ vẫn đồng bộ các SĐT còn lại, bỏ qua riêng các SĐT xung đột này)'
        );
        if (!ok) {
          const conflictPhones = new Set(conflicts.map(c => c.phone));
          selected = selected.filter(r => !conflictPhones.has(r.phone));
          if (!selected.length) { showMsg('zai-zs-sync-status', 'Đã bỏ qua toàn bộ do có xung đột và bạn chọn không ghi đè.', 4000); return; }
        }
      }

      // Buoc 2: ghi that su danh sach da xac nhan
      if (btn) btn.textContent = 'Đang đồng bộ...';
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncZaloFriendStatus', rows: selected }),
        redirect: 'follow'
      });
      const d = await res.json();
      if (d.ok) {
        const skipped = conflicts.length && selected.length < checks.length ? (checks.length - selected.length) : 0;
        showMsg('zai-zs-sync-status', '✓ Đã đồng bộ ' + ((d.updated||0) + (d.appended||0)) + ' khách lên Sasum' + (skipped ? ' (bỏ qua ' + skipped + ' SĐT xung đột)' : ''), 4500);
      }
      else showMsg('zai-zs-sync-status', 'Lỗi: ' + (d.error || 'không rõ'), 4000);
    } catch (e) {
      showMsg('zai-zs-sync-status', 'Lỗi kết nối: ' + e.message, 4000);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '☁ Đồng bộ trạng thái kết bạn lên Sasum'; }
    }
  }


  function init() { buildPanel(); watchZaloChat(); startCarePoll_(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

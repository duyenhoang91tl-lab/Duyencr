# js/ — bảng tra: hàm nằm file nào

Code client của `index.html` (trước đây inline, ~1.4MB) đã tách ra `css/` và `js/`. `index.html` chỉ còn khung HTML + thẻ `<link>`/`<script src>` theo ĐÚNG thứ tự cũ — **không đổi thứ tự thẻ script**.

## Quy ước khi sửa
- Hàm tìm theo tên: `grep -n "function tenHam" js/*.js`.
- Khối lớn đã cắt: file `NN-fn-*.js` = các `function` khai báo cấp cao (nạp trước, mô phỏng hoisting); file `NN-main-*.js` = lệnh chạy ngay (`let/const`, gọi hàm, `addEventListener`...). Thêm hàm mới → đặt vào file `fn-*` gần chức năng; thêm lệnh chạy ngay → file `main-*` cùng khối.
- File không có `fn-`/`main-` là khối script nguyên vẹn (không cắt).
- Đừng dùng lệnh chạy ngay (ở `main-*`) mà phụ thuộc biến `var` gán ở file sau; `let/const` phải khai báo trước khi dùng như bình thường.
- Check cú pháp: `for f in js/*.js; do node -c $f; done`. Sửa xong nhắc reload trang (Ctrl+F5, GitHub Pages cache ~10 phút).

## Danh sách (theo thứ tự nạp)
- `01-fn-splitmulti.js` (1265 dòng, 80 hàm): `splitMulti_`, `_migrateCareStatusIfNeeded`, `_flatCareStatusValues`, `_syncCareStatusFlat`, `_syncKhStatusTreeFromGAS`, `_syncCloseRateThresholdsFromGAS`, `_saveCloseRateThresholds`, …, `_cskhMapFromRows_`, `_loadCskhFromIdb_`, `_cskhFail_`, `_pullCskhLiteOnce_`, `syncFromGS`
- `02-fn-showrowerrorbanner.js` (1223 dòng, 41 hàm): `showRowErrorBanner`, `showSyncErrorBanner`, `pushCareToGS`, `pushOrdersToGS`, `gsGetOrderCount`, `fullSyncOrdersToGS`, `handleFiles`, …, `_schedShortCode`, `_schedNoteShort`, `_schedToggleDay`, `renderScheduleTab`, `renderOverdueTab`
- `03-fn-refreshopendptab.js` (1211 dòng, 53 hàm): `_refreshOpenDpTab`, `markDone`, `markCareSchedDone`, `updateSchedBadges`, `_maybeRefreshOpenDp`, `openDp`, `renderDpTab`, …, `openNickZaloModal`, `closeNickZaloModal`, `_renderNickZaloModalList`, `addNickZaloToList`, `deleteNickZaloFromList`
- `04-fn-synczalophonesettingsfromgas.js` (1212 dòng, 71 hàm): `_syncZaloPhoneSettingsFromGAS`, `_zaloPhoneCanAdd`, `_zaloPhoneFieldVisible`, `_buildZaloPhoneOptions`, `_renderZaloPhoneChips`, `_renderZaloPhoneField`, `addZaloPhoneChip`, …, `updateCSStaffList`, `updateYearFilter`, `updateFilesBar`, `copyPhone`, `openEditPhone`
- `05-fn-saveeditphone.js` (1277 dòng, 116 hàm): `saveEditPhone`, `switchTab`, `exportCSV`, `clearData`, `_hangKeyOf_`, `hangBadge`, `_custRev_`, …, `countAdvFilters`, `applyAdvFilters`, `clearAdvFilters`, `closeAdvModal`, `autoSyncLoop`
- `06-main-renew-sources.js` (541 dòng, 0 hàm)
- `07-openassignmodal.js` (1797 dòng, 72 hàm): `openAssignModal`, `closeAssignModal`, `switchAssignTab`, `_advAssignValidBase`, `_advAssignDateFilteredList`, `_advAssignToggleSrc`, `_advAssignOpenAdvFilter`, …, `showAssignBackendWarning`, `pullBroadcastHistory`, `_bcStatusForPhone`, `_bcStatusBadge`, `updateBroadcastFilter`
- `08-fn-invalidatefiltercache.js` (1206 dòng, 72 hàm): `_invalidateFilterCache`, `_setSig`, `_filterSignature`, `logAudit`, `queueAuditSync`, `flushAuditSync`, `_rebuildAssignIndex`, …, `renderTeamTab`, `_genTeamId`, `addTeam`, `renameTeam`, `setTeamRate`
- `09-fn-deleteteam.js` (1202 dòng, 75 hàm): `deleteTeam`, `setTeamLeader`, `addTeamMember`, `removeTeamMember`, `_vnNorm`, `_teamComboMatches`, `_teamComboShow`, …, `_expLogRun`, `_expLogRenderResult`, `renderKpiPancakeTab`, `_pkLoadKpiReport`, `_pkKpiRefreshIfOpen`
- `10-fn-pkkpipct.js` (1209 dòng, 60 hàm): `_pkKpiPct`, `_pkUniqVals`, `_pkApplyColFilters`, `_pkColTh`, `_pkOpenColFilter`, `_pkColFilterApply`, `_pkColFilterClear`, …, `_srLeaderTeamNames`, `_srEnforceScope`, `_srFetch`, `_srNoDataHtml_`, `_srLoadOptions`
- `11-fn-srload.js` (1229 dòng, 59 hàm): `_srLoad`, `_srSetSub`, `_srSetField`, `_srApplyQuickRange`, `exportSalesReportToSheet`, `_srBuildSaleComboData`, `srSaleComboRender`, …, `_impOnFileSelected`, `_impUpload`, `_impPickCard_`, `renderSalesReportTabJ_`, `renderSalesReportTabD_`
- `12-fn-rendersalesreporttabe.js` (1225 dòng, 61 hàm): `renderSalesReportTabE_`, `_bonusProgramApplies_`, `_ddmmyyyyToYmd_`, `_daysSinceStart_`, `_saleStartDate_`, `_bonusProductQty_`, `_bonusNamesOfOrder_`, …, `_renderBonusProgramsModal`, `_bpEditFormHtml_`, `_bpSave`, `_bpDelete`, `_bpSeedProbationTemplate_`
- `13-fn-bpseedofficialonlinetemplate.js` (1209 dòng, 70 hàm): `_bpSeedOfficialOnlineTemplate_`, `_srPctStr`, `_srGrowthStr`, `_hFold_`, `_hEntryDate_`, `_hGroups_`, `_hGroupIndex_`, …, `renderAssignTeam`, `_setTeamPct`, `_updateTeamAssignTotal`, `doAssignByTeam`, `_aaDefaultCfg`
- `14-fn-aasplit.js` (1215 dòng, 83 hàm): `_aaSplit`, `_aaRatioFor`, `_aaWeights`, `_aaRecipients`, `_aaBuckets`, `_aaPlan`, `_aaPlanCskh`, …, `_findAccount`, `_applyAuthIdentity`, `doLogin`, `doLogout`, `_showLogin`
- `15-fn-hidelogin.js` (595 dòng, 38 hàm): `_hideLogin`, `_authGate`, `_fieldEditBtn`, `_feCfIndex`, `_feCurLabel`, `openFieldEditor`, `_feOpenTree`, …, `_acctCollectNames`, `addAccount`, `deleteAccount`, `resetPassword`, `toggleAcctActive`
- `16-main-currentuser.js` (761 dòng, 0 hàm)
- `17-opencarestatusmodal.js` (382 dòng, 17 hàm): `openCareStatusModal`, `closeCareStatusModal`, `_renderCsParentSel`, `renderCareStatusList`, `editCsLabel`, `removeCsNode`, `convertCsNode`, …, `_initCsDragSort`, `saveCareStatusList`, `_refreshCareStatusUI`, `_applyCareStatusFromGS`, `updateSidebarCareFilters`
- `18-openkhstatusmodal.js` (530 dòng, 27 hàm): `openKhStatusModal`, `closeKhStatusModal`, `_renderKhParentSel`, `_renderKhStatusTree`, `editKhLabel`, `removeKhNode`, `convertKhNode`, …, `_cfLeafToGroup`, `saveCustomFields`, `resetKhStatusToDefault`, `saveKhStatusTree`, `_initKhDragSort`
- `19-opentiertooltip.js` (72 dòng, 3 hàm): `openTierTooltip`, `closeTierTooltip`, `_closeTierOnOutside`
- `20-loadaiexamples.js` (403 dòng, 20 hàm): `loadAiExamples`, `renderAiExamples`, `editAiExample`, `saveAiExample`, `deleteAiExample`, `loadMsgTemplates`, `renderMsgTemplateList`, …, `zaiLookup`, `zaiGenerate`, `zaiCopySug`, `zaiShowError`, `zaiHideError`
- `21-openbroadcastcompose.js` (198 dòng, 11 hàm): `openBroadcastCompose`, `_bcLoadNickList`, `_bcCsNames`, `_bcRenderCsList`, `_bcFilterCsList`, `_bcToggleCs`, `_bcRenderCsChips`, `_showBroadcastComposeModal`, `openBroadcastFromCurrentFilter`, `closeBroadcastCompose`, `submitBroadcastCompose`
- `22-fumycs.js` (138 dòng, 10 hàm): `_fuMyCS`, `_fuIsAdmin`, `runFuScanNow`, `openFuTplModal`, `closeFuTplModal`, `openBdayTplModal`, `_buildFuCsFilter`, `renderFuTplTable`, `addFuTplRow`, `saveFuTpls`
- `23-opendupordersmodal.js` (92 dòng, 6 hàm): `openDupOrdersModal`, `closeDupOrdersModal`, `renderDupOrdersTable`, `fmtDupDate_`, `updateDupOrdersSummary`, `confirmDeleteDupOrders`
- `24-openbctmodal.js` (136 dòng, 7 hàm): `openBctModal`, `_bctOrderDate`, `_bctCodeKws`, `_bctApplyQuickRange`, `_bctCollectPhones`, `bctPreview`, `bctContinue`
- `25-openbcstatmodal.js` (189 dòng, 8 hàm): `openBcStatModal`, `_bcstatCsBreakdown`, `_bcOrderDateMs`, `_bcComputeStats`, `_bcKpi`, `bcstatToggle`, `renderBcStat`, `exportBcStatReport`
- `26-loadtasks.js` (446 dòng, 29 hàm): `loadTasks`, `_taskIsOverdue`, `setTaskScope`, `setTaskStatusFilter`, `renderTaskTables`, `_taskStatusBadge`, `switchTaskSubTab`, …, `renderTaskComments`, `_taskCmAddImages`, `_renderTaskCmPendingImages`, `_taskCmRemoveImage`, `sendTaskComment`

- `27-fn-bonuscore.js`: `_bcOrderInfo_`, `_bcGuess_`, `_bcMinProducts_`, `_bcIsVongProgram_` (lõi đếm SP thưởng; bản sao trong gas_v13.js)
- `28-fn-bonusdetail.js`: tab K "Chi tiết thưởng" — `renderSalesReportTabK_`, `_bdFlag`, `_bdSlot`, `_bdRev`, `_bdSyncFromGAS`
- `43-fn-uxtools.js`: B6 — chế độ tối (`toggleTheme`, css/10-dark.css), hướng dẫn sử dụng (`openHelpModal`), nhật ký lỗi trên máy (`openErrLogModal`)
- `42-fn-homesummary.js`: 4 thẻ số + Phân bổ giai đoạn + Nguồn khách ở Tổng quan (B1) — `hsRender`, `hsLoad`
- `41-fn-stageboard.js`: Bảng Kanban đơn theo giai đoạn Base (B5) — `_sbLoad`, `_sbRender`; GAS ttStageBoard_
- `40-fn-carepage.js`: màn Chăm sóc & tái mua (B4) + bộ tạo tab dùng chung `registerExtraTab`
- `39-fn-buyfilter.js`: bộ lọc Loại khách (Tất cả / Chưa mua / Đã mua) — `setBuy`, `_isBoughtCustomer`
- `37-fn-configpage.js`: trang ⚙ Cấu hình tập trung (B2) — ngưỡng ttStageHours/hmCycle/hmIdle lưu Settings + AuditLog, lần chạy tự động gần nhất, lối tắt
- `36-fn-homechips.js`: 4 chip Hôm nay ở Tổng quan (B1 ROADMAP-CRM-MAU) — `hmCompute`, `hmRenderChips`, `hmOpenList`
- `35-fn-deptsettings.js`: TRANG RIÊNG toàn màn hình "🏢 Phòng ban" (khung `.rs-page` như Phân quyền; mở từ Settings → 🏢 Phòng ban hoặc nút ⚙ Cài đặt phòng ở Tổng quan) — `openDeptSettings`, `closeDeptSettings`, `_dpSave` (ghi deptList + saleDepts rồi ĐỌC LẠI xác nhận), `DEPT_LIST`, `DEPT_DEFAULT`. Test: `tools/test-dept-settings.js`.
- `34-fn-todaytasks.js`: nhắc việc hôm nay cho CS — `ttFetch`, `_ttCards`, `_ttCardHtml` (thẻ trong khung nhắc hẹn; backend gas/23_TodayTasks.gs)

- `31-fn-orgoverview.js`: tab "🏠 Tổng quan" = MÀN HÌNH ĐẦU SAU ĐĂNG NHẬP (tự `switchTab('overview')` khi data-view hiện, trừ tài khoản test) + modal "🪪 Hồ sơ nhân sự" — `_ovLoad`, `_ovScope` (phạm vi xem theo vai trò), `_ovRender`, `openEmployeeProfile`, `_ovAskAI`; gọi GAS `action=orgOverview`.
- `30-fn-teamanalysis.js`: modal "🤖 AI phân tích team" (menu Báo cáo, admin) — `openTeamAnalysisModal`, `runTeamAnalysis`, `_taRender`, `_taSetFilter`, `_taRange`; gọi GAS `action=teamAnalysis`.

- `js/29-sidenav.js` + `css/05-sidenav.css`: menu tác vụ dọc bên trái (ngăn kéo ẩn mặc định, nút ☰ Menu ở header; tái dùng khối `.tabs` nên giữ nguyên data-bar-id/quyền/demo-mode; chọn mục xong tự ẩn).

## Quy ước menu (cập nhật 10/10/2026)
- MỘT nơi duy nhất chứa tính năng: menu trái `js/29-sidenav.js`. `GROUPS` = nhóm mẹ + thứ tự; `ACTS` = mục hành động (gọi lại đúng hàm mở modal cũ, `admin:true` = chỉ admin thấy). Thêm tính năng mới → thêm vào ACTS + GROUPS, KHÔNG thêm nút mới vào header/toolbar.
- Đã bỏ vì trùng: nút header (Tác vụ, Mẫu hỏi thăm, Tình trạng CS, Trạng thái KH, Trường tự tạo, Tài khoản), dropdown "Tác vụ" ở toolbar, "☰ Menu" cũ + tab ⚙ tuỳ chỉnh — ĐÃ XOÁ HẲN code (`openBarCustomizeModal`, `_BAR_ITEM_DEFS`, `_barMenuItems`, đồng bộ key GAS `barMenuItems::<user>` — key này còn nằm trong sheet Settings, vô hại). `_applyBarCustomization` chỉ còn dọn `[data-bar-id]` trùng; `_injectV9UI` chống chèn 2 lần bằng cờ `window._v9UIInjected`.
- Cố ý GIỮ nút theo ngữ cảnh trên màn hình: "Thêm KH / Đơn mới", "Xuất CSV" (toolbar danh sách), "+ Tạo công việc" (tab Công việc). Header chỉ còn: ☰ Menu, trạng thái đồng bộ, pill Google Sheets, Đăng xuất.
- Nhãn "Tình trạng CS"/"Trạng thái KH" lấy từ `FIELD_LABEL_CS/KH` (admin đổi tên được) — đừng ghi cứng.
- ID tab (`data-bar-id`) giữ nguyên vì phân quyền theo tab (`_PERM_TAB_DEFS`) dựa vào chúng.
- Đã gộp/đối chiếu (10/10): tab "Quá hạn" gộp vào "Lịch chăm sóc" qua công tắc `schedSeg()` (vẫn giữ 2 khung + ID `tab-overdue` cho phân quyền; menu trái ẩn mục Quá hạn trừ khi tài khoản chỉ có quyền Quá hạn). Bỏ mục "Đẩy dữ liệu" khỏi menu vì `fullSyncOrdersToGS()` = `syncFromGS` + `pushOrdersToGS()` (hàm vẫn còn, được gọi từ đồng bộ 2 chiều). "Dashboard" (thống kê khách) và "Báo cáo ngày" (KPI sale + checklist MKT theo ngày, từ server) KHÔNG trùng — giữ cả hai.
- `js/32-fn-furesult.js`: P2c — hộp chọn kết quả (đã liên hệ/không nghe máy/từ chối/hẹn lại) khi bấm Xong việc lịch CS tự động; bọc `markDone` của js/03.
- `33-pro-profile.js`: giao diện PRO — hồ sơ khách 360° (`proStageModel_`, `proDaysSinceLastOrder_`, `proKpiHtml_`, `proStageHtml_`, `proRenderProfile_`; bọc `openDp`/`renderDpTab`, chỉ chạy khi `html.ui-pro`)
- `36-pro-home.js`: giao diện PRO — P1 Trang chủ (`proGaugeHtml_`, `proStatusBarsHtml_`, `proRecoItems_`, `proRecoHtml_`, `proHomeHtml_`, `proHomeRender_`). Bọc `_ovRender` (js/31) để chèn khối `#pro-home` ĐẦU màn "🏠 Tổng quan": 2 đồng hồ (% KPI = `target/pct` có sẵn trong orgOverview, tỷ lệ chốt), 4 ô số, Khuyến nghị (`_dueReminders` quá hạn/hôm nay + `_ttCards` đơn Base kẹt), phân bố tình trạng CS (`scopedCustomers`, chỉ đếm tổng hợp). Ẩn hàng ô số cũ trùng (`.pro-hide-old`); chế độ CS "self" giữ nguyên hồ sơ cá nhân. Test: `tools/test-ui-pro-home.js`.
- `34-pro-charts.js`: giao diện PRO — P3 ô số màu + bảng màu cho `_srChartSvg` (`_PRO_CHART_COLORS`, `_proKpiStrip_`, `_proTotalTile_`)
- `38-pro-dock.js`: giao diện PRO — P4 thanh tab hồ sơ đang mở, dock phải, Trợ lý AI hỏi đáp khách/doanh số (`proTabsAdd_`, `proScrub_`, `proCustomerContext_`, `proSalesContext_`, `proAskPrompt_`, `proAskRequest_`; gọi `action=ai` + `crmAsk:true`, gas v13.32)
- `40-main-restorenav.js`: F5 không mất chỗ — ghi mục menu đang mở (`.tab.active[data-bar-id]`) + SĐT khách đang mở hồ sơ vào hash `#v=..&c=..` và sessionStorage `ome_nav_v1` (bọc `openDp`/`closeDp`/`doLogout`); sau F5 đợi data-view hiện + dữ liệu rồi bấm lại mục menu và `openDp` lại; gỡ khung `#boot-splash` (index.html) khi có form đăng nhập hoặc có dữ liệu. Không đụng luồng đăng nhập.
- `43-fn-viewstate.js`: F5 giữ BỘ LỌC + VỊ TRÍ CUỘN + TAB HỒ SƠ KHÁCH (bổ sung cho 40): sessionStorage `ome_view_v1` (ô tìm kiếm, sắp xếp, nguồn dữ liệu, năm/tháng/giờ/ngày, chiến dịch, chưa tác động, lọc CS, chip Hạng/Tình trạng/Zalo, `scrollTop` của `_vtWrap()`, `currentDpTab`). Khôi phục sau khi dữ liệu hiện + 1,5s; bỏ qua nếu người dùng đã tự đổi lọc; không ghi đè khi đang khôi phục.
- `41-fn-pkchat.js`: tab 💬 Chat Pancake trong panel chi tiết khách (`renderPkChatTab`, `pkcLoad` poll 6s, `pkcSend`, `pkcFind`/`pkcLink` gắn hội thoại theo SĐT). Gọi GAS `pkChat`/`pkChatFind`/`pkChatLink`/`pkChatSend` (gas/25_PancakeChat.gs). Test: `tools/test-pk-chat-ui.js`.
- js/42-fn-socialchat.js: Social > Chat (hộp thư Pancake chung; GAS pkChatInbox/pkChatConv). Menu 'Hồ sơ' = gộp KH + nhân viên (js/29).

## Chat nội bộ (11/10/2026)
- `js/43-teamchat.js` + `css/07-teamchat.css`: tab 💬 Chat (id `tab-teamchat`, nhóm "Social" ở menu trái (cạnh "Chat (Social)" = hộp thư Pancake — 2 tính năng KHÁC NHAU)). Backend `gas/26_Chat.gs`. Chi tiết, quy ước bảo mật, giới hạn: `docs/CHAT-NOI-BO.md`.
- Mọi request kèm token phiên (`ome_sess_token`); không dùng được với tài khoản demo. KHÔNG tin tên người gửi từ client.
- Test: `node tools/test-chat.js` (backend) và `python3 tools/test-chat-e2e.py` (giao diện + backend).

- `44-fn-taskflow.js`: Công việc kiểu Base — quy trình/giai đoạn: `loadTaskFlows`, chọn quy trình khi tạo việc (`_tfInit/_tfCollect/_tfValidate`), modal chi tiết (`_tfStageModel`, `_tfDetailHtml`, `_tfAdvance`, `_tfDecide`), thảo luận có tệp (ghi đè `renderTaskComments`/`sendTaskComment`/`switchTaskDetailTab` của js/26). Gợi ý @ + thông báo: js/39-fn-notify.js. Backend GAS `taskFlows/taskAdvance/taskRequestDecide`.
- `45-fn-taskflow-admin.js`: màn quản lý quy trình (`openTaskFlowManager`, `_tfm*`; menu trái `act:taskflow` admin) + bộ lọc việc cần tôi (`_tfScopeMatch`, `_tfCounts`, bọc `renderTaskTables`). Test: `tools/test-task-flow-client.js`.
- `46-fn-kho.js`: `openKhoModal`, `tkLoadKho`, `tkLoadItems`, `tkEditDlg`, `tkItemDlg`, `tkImportDlg` (đọc Excel Pos qua `_tkParseSheet`), `tkHistDlg`, `tkManageDlg` — mục Tồn kho (backend: gas_v13.js khối KHO; CSS `css/08-kho.css`)
- `47-staff-profile.js`: Hồ sơ nhân viên — `openProfileModal` (menu `act:profile` nhóm Hồ sơ + nút 🪪 ở header): form họ tên/SĐT/email/Facebook + tổng quan kết quả theo kỳ (11 thẻ). Backend `gas/28_StaffProfile.gs` (profileGet/profileSave/staffOverview); khách đang giữ + đã kết bạn đếm tại client (`_spCustStats`). Test: `tools/test-staff-profile-ui.js` (jsdom), `tools/test-staff-profile.js` (backend).
- `48-pro-chatinfo.js`: giao diện PRO — P5 cột "Thông tin khách" bên phải Social > Chat kiểu Pancake (`proPhoneNorm_`, `proInitials_`, `proChatInfoHtml_`, `proChatInfoRender_`; được `js/42-fn-socialchat.js` gọi từ `scPick`). Test: `tools/test-ui-pro-chatinfo.js`
- `49-pro-discuss.js`: Thảo luận khách nội bộ (hộp chat theo SĐT + tag @) cho tab 🗨 Thảo luận trong hồ sơ khách và cột phải Social > Chat; `proNoteAdd_` lưu ghi chú nhanh không cần panel hồ sơ (`khdMount_`, `khdSend_`, `renderKhdTab`, `proNoteAdd_`). Backend `gas/30_KhDiscuss.gs`. Test: `tools/test-ui-pro-discuss.js`
- `10-fn-pkkpipct.js` (đầu file): `_warnBox(key, boxHtml, label)` / `_warnToggle` — bọc cảnh báo ⚠️ trong báo cáo, mặc định ẩn, bấm 👁 mới hiện (dùng cả ở js/11 tỷ lệ chốt). Xem docs/crm-kb/05-sasum-reports-ui.md.
- `43-fn-uxtools.js`: thêm `_guidesOn/applyGuides/setGuides` — công tắc hiện/ẩn lời hướng dẫn (class `guide-text`, mặc định ẩn; ô bật trong ❓ Hướng dẫn sử dụng). Xem docs/crm-kb/05-sasum-reports-ui.md.

## js/51-demo-guard.js — tài khoản test (2026-10-15)
Nạp sau `js/50`. Khi có `ome_demo_token`: hiển thị `…0000` → `••••` (SĐT đã bị máy chủ che) và mã hóa mọi file tải về (`a.download`, `XLSX.writeFile`) thành `.enc`. Giải mã: `tools/decrypt-demo-file.js`. Chi tiết: `docs/TAI-KHOAN-TEST.md`.
- `40-fn-rolesettings.js` (L3, 14/10/2026): trang "Vai trò & quyền hạn" 3 tab (Quyền vai trò · Quyền từng người · Phòng ban & nhóm) — thẻ vai trò, ma trận Bật/Tắt có mô tả, cột Admin khóa, hàng cố định, Thay đổi gần đây (AuditLog `config:roleConfig`). Hàm mới: `_rsToggle`, `_rsMatrix2`, `_rsRoleCardsHtml`, `_rsPersonHtml`, `_rsDeptTabHtml`, `_rsDiffSummary`, `_rsLoadRecent`. CSS: `css/11-roles.css` (`rl-*`). Test: `node tools/test-roles-page.js`
<<<<<<< HEAD
- `48-filter-presets.js`: Mẫu lọc nhanh Báo cáo doanh số (A,B,C,D,E,F,G,L): thanh `#fp-bar` chèn sau dòng chọn báo cáo (bọc `renderSalesReportTab`); mẫu = tên + Sale (+Kênh/Nguồn/Sản phẩm…, không ngày, không ô Lọc theo Team) theo từng báo cáo + từng tài khoản, lưu localStorage `ome_sr_filter_presets_v1:<username>`. Bấm mẫu → gán `_srState` rồi `_srApply()`. Thêm nút lọc nhanh theo ĐỘI (SALE_CHANNELS) + bảng đối chiếu Team→Sale (`_srState._teamSyncInfo`). Test: `tools/test-filter-presets.js`, `tools/test-team-filter.js`.
- `52-fn-salematch.js`: `openSaleMatchModal`, `smSave`, `_smAddTo`, `_smRemoveFromGroups` — mục 🔗 Khớp sale (Cài đặt team): khớp mọi tên của 1 người (Pancake/Base/Pos/CRM/Facebook), lưu `salePersonTags`; backend `saleMatchCandidates_` (CSS `css/12-salematch.css`)
=======
- `48-filter-presets.js`: Mẫu lọc nhanh Báo cáo doanh số (A,B,C,D,E,F,G,L): thanh `#fp-bar` chèn sau dòng chọn báo cáo (bọc `renderSalesReportTab`); mẫu = tên + Sale (+Kênh/Nguồn/Sản phẩm…, không ngày, không ô Lọc theo Team) theo từng báo cáo + từng tài khoản, lưu localStorage `ome_sr_filter_presets_v1:<username>`. Bấm mẫu → gán `_srState` rồi `_srApply()`. Test: `tools/test-filter-presets.js`.
- `55-fn-shell.js` (L1, 14/10/2026): khung navy — bật/tắt class `ui-shell` / `shell-collapsed` trên `<html>` (menu ghim, Thu gọn, Giao diện cũ/mới), thêm chân menu `.sh-foot`; `shellDecide_` (thuần). CSS: `css/13-shell.css` (mọi selector trong `html.ui-pro.ui-shell`). Test: `node tools/test-shell.js`
>>>>>>> 02fa261 (L1: khung xanh navy (menu ghim + thanh tren navy + tam noi dung bo goc) theo anh Duyen chon — co nut Thu gon va Giao dien cu, khong doi logic menu)

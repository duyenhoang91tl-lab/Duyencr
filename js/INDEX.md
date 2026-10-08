# js/ — bảng tra: hàm nằm file nào

Code client của `index.html` (trước đây inline, ~1.4MB) đã tách ra `css/` và `js/`. `index.html` chỉ còn khung HTML + thẻ `<link>`/`<script src>` theo ĐÚNG thứ tự cũ — **không đổi thứ tự thẻ script**.

## Quy ước khi sửa
- Hàm tìm theo tên: `grep -n "function tenHam" js/*.js`.
- Khối lớn đã cắt: file `NN-fn-*.js` = các `function` khai báo cấp cao (nạp trước, mô phỏng hoisting); file `NN-main-*.js` = lệnh chạy ngay (`let/const`, gọi hàm, `addEventListener`...). Thêm hàm mới → đặt vào file `fn-*` gần chức năng; thêm lệnh chạy ngay → file `main-*` cùng khối.
- File không có `fn-`/`main-` là khối script nguyên vẹn (không cắt).
- Đừng dùng lệnh chạy ngay (ở `main-*`) mà phụ thuộc biến `var` gán ở file sau; `let/const` phải khai báo trước khi dùng như bình thường.
- Check cú pháp: `for f in js/*.js; do node -c $f; done`. Sửa xong nhắc reload trang (Ctrl+F5, GitHub Pages cache ~10 phút).

## Danh sách (theo thứ tự nạp)
- `01-fn-splitmulti.js` (1254 dòng, 80 hàm): `splitMulti_`, `_migrateCareStatusIfNeeded`, `_flatCareStatusValues`, `_syncCareStatusFlat`, `_syncKhStatusTreeFromGAS`, `_syncCloseRateThresholdsFromGAS`, `_saveCloseRateThresholds`, …, `_cskhMapFromRows_`, `_loadCskhFromIdb_`, `_cskhFail_`, `_pullCskhLiteOnce_`, `syncFromGS`
- `02-fn-showrowerrorbanner.js` (1223 dòng, 41 hàm): `showRowErrorBanner`, `showSyncErrorBanner`, `pushCareToGS`, `pushOrdersToGS`, `gsGetOrderCount`, `fullSyncOrdersToGS`, `handleFiles`, …, `_schedShortCode`, `_schedNoteShort`, `_schedToggleDay`, `renderScheduleTab`, `renderOverdueTab`
- `03-fn-refreshopendptab.js` (1211 dòng, 53 hàm): `_refreshOpenDpTab`, `markDone`, `markCareSchedDone`, `updateSchedBadges`, `_maybeRefreshOpenDp`, `openDp`, `renderDpTab`, …, `openNickZaloModal`, `closeNickZaloModal`, `_renderNickZaloModalList`, `addNickZaloToList`, `deleteNickZaloFromList`
- `04-fn-synczalophonesettingsfromgas.js` (1212 dòng, 71 hàm): `_syncZaloPhoneSettingsFromGAS`, `_zaloPhoneCanAdd`, `_zaloPhoneFieldVisible`, `_buildZaloPhoneOptions`, `_renderZaloPhoneChips`, `_renderZaloPhoneField`, `addZaloPhoneChip`, …, `updateCSStaffList`, `updateYearFilter`, `updateFilesBar`, `copyPhone`, `openEditPhone`
- `05-fn-saveeditphone.js` (1277 dòng, 116 hàm): `saveEditPhone`, `switchTab`, `exportCSV`, `clearData`, `_hangKeyOf_`, `hangBadge`, `_custRev_`, …, `countAdvFilters`, `applyAdvFilters`, `clearAdvFilters`, `closeAdvModal`, `autoSyncLoop`
- `06-main-renew-sources.js` (539 dòng, 0 hàm)
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

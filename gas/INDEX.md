# gas/ — bảng tra: sửa gì thì mở file nào

> **TỰ SINH bởi `node tools/split-gas.js` — KHÔNG sửa tay.** Nguồn chính là `gas_v13.js`; file trong `gas/` chỉ để dán vào Apps Script.

Tìm nhanh: `node tools/split-gas.js --where <tên hàm>`

## QUY TẮC KHI SỬA BACKEND GAS (cho mọi phiên Claude / người sửa)
1. **Chỉ sửa `gas_v13.js`** (nguồn chính). KHÔNG sửa tay file trong `gas/`.
2. Tìm chỗ cần sửa: `node tools/split-gas.js --where <tên hàm>` hoặc xem bảng bên dưới; hàm dùng chung thì grep toàn bộ nơi gọi trong `gas_v13.js` trước khi sửa.
3. Sửa xong chạy `node tools/split-gas.js` (sinh lại `gas/*.gs` + file này), rồi `node tools/split-gas.js --check` phải báo OK.
4. Chạy `git status --short gas/` (hoặc `git diff --stat gas/`): **các file `.gs` bị đổi chính là danh sách file người dùng phải dán lại** vào Apps Script Editor.
5. Trong câu trả lời, LUÔN nêu rõ: *"Dán đè các file: <tên file 1>, <tên file 2>… rồi Deploy → Manage deployments → New version → Deploy"*. Không cần dán các file không đổi.
6. Thêm hàm mới thì nó nằm đúng file theo vị trí trong `gas_v13.js`; nếu 1 file phình quá ~45KB hoặc thêm cả mảng chức năng mới, thêm mốc mới vào `PARTS` trong `tools/split-gas.js` (tạo file mới → nhắc người dùng tạo thêm file đó trong Editor).
7. Nếu file được sinh ra là file MỚI (chưa có trong Editor) hoặc bị đổi tên: nhắc người dùng tạo/đổi tên file tương ứng trong Editor.

## 01_Config_Utils.gs
- Hàm: `getOrderSS_`, `getCrmSS_`, `getSheet_`, `getOrderSheet_`, `jsonOut_`, `getOrderSheetName_`, `normPhone_`, `isValidVnPhone_`, `_stripVN_`, `_detectHeaderRow_`
- Hằng/biến: `SH_CARE`, `SH_TEAM`, `SH_MKT_TEAM`, `MKT_TEAM_HEADERS`, `SH_AUDIT`, `SH_SET`, `SH_ASSIGN`, `SH_USER`, `SH_CONTEXT`, `SH_PK_STATS`, `SH_PK_MAP`, `SH_PK_SDT`, `SH_SALE_DIR`, `SH_PK_PAGEMAP`, `SH_PK_TAG`, `ORDER_SS_ID`, `CRM_SS_ID`, `PRICE_SS_ID`, `EXPORT_BASE_SS_ID`, `EXPORT_BASE_GID`, `PRICE_SHEET_NAME`, `CTKM_SHEET_NAME`, `DEFAULT_PRODUCT_SHEET_URL`, `DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL`, `DEFAULT_DRIVE_PRODUCT_IMAGES_FOLDER_URL`, `ORDER_SHEETS`, `SH_ORDER_DEFAULT`, `CARE_HEADERS`, `ORDER_HEADERS`, `TEAM_HEADERS`, `AUDIT_HEADERS`, `SET_HEADERS`, `ASSIGN_HEADERS`, `ASSIGN_CHUNK`, `USER_HEADERS`, `PK_STATS_HEADERS`, `PK_MAP_HEADERS`, `PK_SDT_STATS_HEADERS`, `PK_PAGEMAP_HEADERS`, `PK_TAG_STATS_HEADERS`, `SH_CARE_LEAD`, `CARE_LEAD_HEADERS`

## 02_PriceCatalog_CTKM.gs
- Hàm: `readPriceCatalog_`, `_colLetter_`, `_cachePutBig_`, `_cacheGetBig_`, `_ordersCacheClear_`, `_priceCols_`, `_productImgCols_`, `buildProductImageFlat_`, `driveImageFromLinkAction_`, `_priceNumK_`, `buildPriceCatalogFlat_`, `buildPriceCatalogTree_`, `searchPriceCatalog_`, `_priceFieldPick_`, `_priceAllPrices_`, `_priceVariantsForPrompt_`, `_ctkmDetectCols_`, `_ctkmParseDate_`, `_ctkmFmtDateVN_`, `readCTKMCatalog_`, `readCTKMPromotions_`
- Hằng/biến: `PRICE_LAST_COL_`, `GIA_COL_MIN_`, `GIA_COL_LIMIT_`, `_PRICE_STOPWORDS_`, `_CTKM_END_KW_`, `_CTKM_START_KW_`, `_CTKM_EXCL_KW_`, `_CTKM_KEYWORDS_`

## 03_Settings_CareRead.gs
- Hàm: `getSetting_`, `getSettingsMulti_`, `setGasSource_`, `readSaleGroups_`, `saveSaleGroups_`, `_saleGroupLabel_`, `_auditClip_`, `_auditActor_`, `_auditCfg_`, `_auditDiffRows_`, `_auditUserSig_`, `setSetting_`, `_syncSaleChannelsToUsers_`, `addZaloNick_`, `readCareStatus_`, `careObjFromRow_`, `readCare_`, `readCareDelta_`, `readRemindersToday_`, `_remindersFromRows_`, `findCareByPhone_`, `careRow_`, `readExistingExtFields_`, `mergeExtFields_`, `_legacyReadOrdersUnused_`, `readTeams_`, `readUsers_`, `_secEq_`, `_adminKeyOk_`, `_isSensitiveSettingKey_`, `_isSensitiveWriteKey_`, `_demoToken_`, `_demoTokenOk_`, `_demoSrcOf_`, `_demoClipPerSource_`, `_demoMaskPhone_`, `_demoMaskText_`, `_demoMaskDeep_`, `_demoClip_`, `demoLogin_`, `_sessSecret_`, `_sessSign_`, `_sessIssue_`, `_sessVerify_`, `_sessUser_`, `_usersForClient_`, `_roleStrList_`, `_roleCfgNormalize_`, `readRoleConfig_`, `_roleResolve_`, `_roleBase_`, `_userDeptKeys_`, `_featureAllowed_`, `_featureGate_`, `roleConfigForClient_`, `saveRoleConfig_`, `_usersWriteAuth_`, `_upgradePwHash_`, `_checkLogin_`, `webLogin_`, `_ntlKey_`, `_extKeys_`, `_extKeyNew_`, `_extKeyEnsure_`, `_extKeyRotate_`, `_extKeyWho_`, `xemKhoaExtension`, `doiKhoaZalo`, `doiKhoaPancake`, `_enfModes_`, `_enfSet_`, `_srcBucket_`, `_enforceCheck_`, `xemTrangThaiChan`, `batChanWeb`, `tatChanWeb`, `batChanZalo`, `tatChanZalo`, `batChanPancake`, `tatChanPancake`, `batChanKhac`, `tatChanKhac`, `_ownerUsers_`, `_isOwner_`, `_ownerGate_`, `datChuSoHuu`, `xoaChuSoHuu`, `xemChuSoHuu`, `xemBiMatPhien`, `_ntlNote_`, `_ntlReport_`, `xemLogKhongToken`
- Hằng/biến: `SALE_GROUPS_DEFAULT_`, `_AUDIT_TOKEN_`, `AUDIT_SKIP_SETTING_`, `DEMO_MAX_ROWS_`, `DEMO_ALLOWED_GET_`, `DEMO_CLIP_KEYS_`, `DEMO_CLIP_ROWS_ACTIONS_`, `DEMO_PHONE_KEY_RE_`, `DEMO_NOTE_KEY_RE_`, `DEMO_PHONE_STR_RE_`, `SESS_TTL_MS_`, `ROLE_BUILTIN_`, `ROLE_BASES_`, `ACTION_FEATURE_`, `NTL_ACTIONS_`, `EXT_KEY_NAMES_`, `EXT_ALLOWED_`, `ENF_SOURCES_`, `OWNER_ONLY_ACTIONS_`

## 04_doGet.gs
- Hàm: `doGet`, `doGetCore_`

## 05_Orders_DTTong.gs
- Hàm: `buildDashboard_`, `dtRowToOrder_`, `readAllOrders_`, `findDonRowsByPhone_`, `readOrdersByPhone_`, `_dedupeSameOrders_`, `_readOrdersByPhoneSheets_`, `_stripHonorific_`, `_truncateAtAddressOrDigit_`, `_isPlausibleName_`, `_guessNameCandidatesFromOrderText_`, `_parseNameFromOrderText_`, `_guessNameForPhone_`, `previewCustomerNameGuesses_`, `applyCustomerNameGuesses_`, `getDTSS_`, `_dtCellToVnStr_`, `_vnMidnight_`, `_vnYmd_`, `_vnYmdParts_`, `parseVNDate_`, `_dateStrToVnYmd_`, `dateInRange_`, `_isExcludedOrderStatus_`, `_normMoney_`, `splitMulti_`, `_pancakeKnownSaleNameSet_`, `_userAliasGroups_`, `_makeTeamResolver_`, `_expandSaleFilterWithPancakeAliases_`, `_donSaleNamesFromThe_`, `_donHasExcludedStatus_`, `_hiddenPageSaleSets_`, `_isDTRowHidden_`, `readDTTong_`
- Hằng/biến: `DT_SS_ID`, `DT_TONG_SHEET`, `DON_CHITIET_SHEET`, `DON_CHITIET_WIDTH`, `DON_COL_GHICHU`, `DT_COL_NGAYTAO`, `DT_COL_GIAOCHO`, `DT_COL_PHONE`, `DT_COL_GIAIDOAN`, `DT_COL_TRANGTHAI`, `DT_COL_THOIGIANHT`, `DT_COL_KENHBAN`, `DT_COL_SALEBAN`, `DT_COL_SANPHAM`, `DT_COL_PHANLOAI`, `DT_COL_GIATRICOC`, `DT_COL_GIATRIDON`, `DT_COL_GIATRICHENH`, `DT_COL_ID`, `DT_TONG_WIDTH`, `DT_DATE_SENTINEL_`, `NAME_ADDR_KEYWORDS_RE_`, `NAME_MERGE_LABEL_RE_`, `NAME_ALLOWED_CHARS_RE_`, `VN_OFFSET_MS`, `EXCLUDED_ORDER_STATUSES_`, `__pancakeKnownSaleSet_`, `POS_EXTRA_SALE_NAMES_`, `POS_EXCLUDED_ORDER_STATUSES_`

## 06_CSKH_CareLeads_Don.gs
- Hàm: `_findCskhDuyenSheet_`, `_cskhHeaderMap_`, `_cskhCell_`, `readCskhDuyen_`, `_cskhPhoneIndex_`, `findCskhRowsByPhone_`, `findCskhRowsCached_`, `readCskhDuyenLite_`, `_readCskhDuyenLiteBuild_`, `_xoaSdtScan_`, `_xoaSdtRuns_`, `xoaSdtKhongPhaiVN_`, `xoaSdtLoiCskhThu`, `xoaSdtLoiCskhThat`, `xoaSdtLoiThu`, `xoaSdtLoiThat`, `readCareLeads_`, `addCareLead_`, `readDonPhones_`, `getDonSaleByPhone_`, `getDonStatsByPhone_`, `getDonOrderCountByPhone_`, `getDonOrdersByPhone_`, `searchOrderCode_`, `buildDonProducts_`, `getDonLastDateByPhone_`, `_donConvertRows_`, `readDonChiTiet_`, `_sheetByGid_`
- Hằng/biến: `CSKH_DUYEN_SHEET_KEY_`, `CSKH_DUYEN_FIELDS_`, `XOA_SDT_BUDGET_MS_`

## 07_SalesReportA.gs
- Hàm: `getSalesReportOptions_`, `_dtIsExchangeOrder_`, `_dtOrderRevenue_`, `_srCloseRateSections_`, `_extractPageIdFromNguonDon_`, `_extractPageNameFromNguonDon_`, `buildSalesReportA_`

## 08_SaleKPI_FailedOrders.gs
- Hàm: `readSaleKpiConfig_`, `_ymAdd_`, `_ymMonthsBetween_`, `_ymFirstDay_`, `_ymLastDay_`, `_todayYm_`, `_computeSaleMonthlyRevenue_`, `_computeSaleTierTimeline_`, `buildSaleKpiReport_`, `buildFailedOrderReport_`
- Hằng/biến: `SALE_TIER_ORDER_`, `SALE_TIER_DEFAULT_TARGETS_`, `SALE_TIER_META_`, `SALE_KPI_DEFAULT_CFG_`

## 09_SalesReportB_POS.gs
- Hàm: `_normCounterCode_`, `_counterCodeNoYear_`, `_counterCodeHasYear_`, `_extractCounterCodes_`, `_detectBaseCounterCol_`, `_readBaseRowsByCounterCodes_`, `_pickBaseRowsForCode_`, `_resolveGhepDon_`, `_isOriginalCounterNote_`, `_tachDonParse_`, `_tachDonKey_`, `_mergeTachDon_`, `_quaySaleRatio_`, `_foldSaleKey_`, `_resolveBonusSale_`, `_acctCodeNoYear_`, `_loadAcctSplit_`, `_acctMatchCodes_`, `_acctSharesOf_`, `buildSalesReportB_`
- Hằng/biến: `POS_GHEP_BASE_ENABLED_`, `POS_GHEP_MIN_CODES_`, `COUNTER_CODE_INNER_`, `COUNTER_CODE_RE_SRC_`, `TACH_DON_RE_SRC_`, `QUAY_SALE_RATIO_`, `ACCT_SPLIT_SS_ID_`

## 10_CSStats_KPI_ReportC.gs
- Hàm: `_csJsonSetting_`, `_csYmdFromDmy_`, `_csDaysSinceStart_`, `_csBonusProductQty_`, `_csBonusApplies_`, `_csRequireProductOk_`, `_csMoney_`, `_csBonusSummary_`, `_bcFold_`, `_bcCounterOf_`, `_bcGuess_`, `_bcLineCls_`, `_bcOrderLines_`, `_bcOrderInfo_`, `_bcMinProducts_`, `_bcIsVongProgram_`, `_bcRequireKw_`, `buildCsStats_`, `ensureKPISheet_`, `readKPITargets_`, `getKPI_`, `_getMonday_`, `_isoWeekRange_`, `_isoWeekKey_`, `_monthRange_`, `_monthKey_`, `_quarterRange_`, `_yearRange_`, `_yearKey_`, `_quarterKey_`, `_ymdLocal_`, `_labelVN_`, `_resolvePeriods_`, `buildSalesReportC_`, `buildCareLeadReport_`
- Hằng/biến: `CS_COMMISSION_THRESHOLD_`, `BONUS_PRODUCT_MAP`, `KPI_SHEET`

## 11_ExportSheet_doPost.gs
- Hàm: `exportSalesReportToSheet_`, `doPost`, `doPostCore_`

## 12_SaveCare_Orders_Dedupe.gs
- Hàm: `invalidateLookupCache_`, `saveAllCare_`, `saveSingleCare_`, `saveBatchCare_`, `syncZaloFriendStatus_`, `saveOrders_`, `patchOrder_`, `deleteOrder_`, `normOrderDate_`, `_normTxt_`, `findDuplicateOrders_`, `deleteDuplicateOrders_`, `_rowKeyExact_`, `_rowIsBlank_`, `_autoDedupExactRowsInSheet_`, `_autoDedupLog_`, `onChangeDedupTrigger_`, `installAutoDedupTrigger_`, `_impHm_`, `_impOrderKey_`, `doImportSheetRows_`, `doImportSheetRowsLocked_`, `replaceOrders_`, `setOrderCareCS_`, `setOrderCareCSBatch_`, `_auditTeamSig_`, `_auditTeamMap_`
- Hằng/biến: `SH_AUTO_DEDUP_LOG`, `AUTO_DEDUP_LOG_HEADERS`

## 13_Teams_Pancake.gs
- Hàm: `saveTeams_`, `readMktTeams_`, `saveMktTeams_`, `_mktPageWeights_`, `_mktKenhWeights_`, `savePancakeStats_`, `readPancakeMapCI_`, `readPancakeMap_`, `pancakeAllNames_`, `savePancakeNameMap_`, `_pkStatsRowsMemo_`, `buildPancakeReport_`, `savePancakeSdtStats_`, `buildPancakeSdtReport_`, `readPancakePageMap_`, `readPancakePageMapByName_`, `pancakeAllPages_`, `savePancakePageMap_`, `classifyPancakeTag_`, `savePancakeTagStats_`, `buildPancakeTagReport_`, `_tagFunnelRates_`, `_pkSheetDateSpan_`, `saveSaleDirectory_`, `readSaleDirectory_`, `_pkTrackedDatesByPageAndSale_`, `_sumOrdersOnDates_`
- Hằng/biến: `_pkStatsRowsMemoCache_`, `_pkReportMemoCache_`, `PK_STATUS_CODES_`, `SALE_DIR_HEADERS`

## 14_KpiReport_Users_Assign.gs
- Hàm: `buildKpiReport_`, `saveUsers_`, `saveAudit_`, `saveCareStatus_`, `readAssign_`, `assignRowsOf_`, `saveAssignEntry_`, `toggleAssignDone_`, `saveAssignHistory_`, `readAIContext_`, `_pwHash_`, `verifyLogin_`, `saveAIContext_`
- Hằng/biến: `_PW_SALT_`, `_PW_SALT_OLD_`

## 15_ProductSheets_Drive.gs
- Hàm: `_psheetNoAccent_`, `_careMapByPhone_`, `_pMatchAny_`, `_foldTermsCSV_`, `_productSheetIndexForTab_`, `readFaqSheet_`, `readExternalProductSheet_`, `callGroqAI_`, `_posEarliestValidDayByPhone_`, `_posIsResale_`, `_posSaleFractions_`, `posMetrics_`, `xemChiSoPos`, `_taNum_`, `_taClamp_`, `_taMedian_`, `buildTeamMetrics_`, `scoreTeam_`, `_taCallAI_`, `_taParseJson_`, `teamAnalysis_`, `_orgAgg_`, `readDeptList_`, `readSaleDepts_`, `_orgApplyDepts_`, `orgOverview_`, `_driveFolderIdFromUrl_`, `_chunkText_`, `_driveKnowFullTextCacheKey_`, `_cacheDriveKnowFullText_`, `_extractPdfText_`, `_driveKnowChunkText_`, `_driveKnowledgeFileIndex_`, `readDriveKnowledgeFolder_`, `_driveImageIndex_`, `_driveImageFromLink_`, `findProductSheetImage_`, `findDriveProductImage_`, `_driveImageBase64_`
- Hằng/biến: `_PSHEET_STOPWORDS_`, `DEPT_LIST_DEFAULT_`, `_DRIVE_IMG_MAX_BYTES_`

## 16_BannedWords_AI.gs
- Hàm: `readBannedWordsList_`, `_bannedWordsPromptBlock_`, `_priceCatalogRowsCached_`, `priceAsk_`, `_priceQaSystemPrompt_`, `priceQa_`, `_crmAskPriceBlock_`, `_buildAISystemPrompt_`, `_aiOpenAICompat_`, `_aiGemini_`, `_crmAskSystemPrompt_`, `callAI_`, `_maskKey_`, `diagApiKeys`, `testScript`
- Hằng/biến: `BANNED_WORDS_SS_ID`, `BANNED_WORDS_GID`

## 17_Broadcast_FollowUp.gs
- Hàm: `getBroadcastSheet_`, `readBroadcasts_`, `_noPromoSet_`, `_dropNoPromoPhones_`, `saveBroadcast_`, `broadcastMark_`, `broadcastQueueForCS_`, `uploadBroadcastImage_`, `broadcastSetStatus_`, `broadcastCancel_`, `fuSourceAllowed_`, `_fuConfig_`, `readProductCodeMapFromSheet_`, `getProductCodeMap_`, `productCodeFromText_`, `readFollowUpTemplates_`, `listFollowUpTemplates_`, `saveFollowUpTemplates_`, `renderFollowUpTemplate_`, `_fuResultClean_`, `saveFuResults_`, `readFuResults_`, `readFollowUpLogKeys_`, `appendFollowUpLogRows_`, `readZaloScanByPhone_`, `dedupeCare_`, `runDedupeCare`, `saveZaloScan_`, `runFollowUpScan_`, `runFollowUpScanTrigger`
- Hằng/biến: `SH_BROADCAST`, `BROADCAST_HEADERS`, `BROADCAST_FOLDER_ID`, `SH_FU_TEMPLATE`, `FU_TEMPLATE_HEADERS`, `SH_FU_LOG`, `FU_LOG_HEADERS`, `SH_ZALO_SCAN`, `ZALO_SCAN_HEADERS`, `FU_CHECKPOINTS`, `FU_START`, `FU_SOURCES`, `PRODUCT_CODE_MAP_`, `_productCodeMapCache_`, `SH_FU_RESULTS`, `FU_RESULT_HEADERS`, `FU_RESULT_KEYS_`

## 18_Tasks_Menh_MsgTpl.gs
- Hàm: `_taskJson_`, `_taskFromRow_`, `_taskToRow_`, `_taskFind_`, `readTasks_`, `saveTaskEntry_`, `deleteTask_`, `readTaskComments_`, `_notifIsWordCh_`, `_notifParseMentions_`, `_notifyMentions_`, `readNotifications_`, `markNotifRead_`, `saveTaskComment_`, `_taskActor_`, `_taskCancelPending_`, `_taskInList_`, `_taskMentionNames_`, `_notifyTaskEvent_`, `_taskSysComment_`, `_taskFlowSeed_`, `readTaskFlows_`, `_taskFlowById_`, `saveTaskFlow_`, `deleteTaskFlow_`, `readTaskRequests_`, `_taskDoAdvance_`, `taskAdvance_`, `taskReassign_`, `taskRequestDecide_`, `menhFromYear_`, `buildMenhRows_`, `ensureMenhSheedSeeded_`, `ensureCannedSheetSeeded_`, `getMessengerKnowledge_`, `_aiExId_`, `readAIExamples_`, `saveAIExample_`, `deleteAIExample_`, `saveCannedResponse_`, `deleteCannedResponse_`, `_tplCaller_`, `_tplRowToObj_`, `_tplOwns_`, `readMessageTemplates_`, `saveMessageTemplate_`, `deleteMessageTemplate_`, `approveMessageTemplate_`
- Hằng/biến: `SH_TASK`, `TASK_HEADERS`, `SH_TASK_COMMENT`, `TASK_COMMENT_HEADERS`, `SH_NOTIF`, `NOTIF_HEADERS`, `SH_TASK_FLOW`, `TASK_FLOW_HEADERS`, `SH_TASK_REQ`, `TASK_REQ_HEADERS`, `SH_MENH`, `SH_CANNED`, `MENH_DEFAULT_ROWS`, `MENH_SHEET_MARK`, `CANNED_DEFAULT_ROWS`, `SH_MSG_TPL`, `MSG_TPL_HEADERS`, `MSG_TPL_APPROVER_ROLES_`, `MSG_TPL_STATUS_`

## 19_BannedList_MktChecklist.gs
- Hàm: `readBannedWords_`, `_mktMonthOf_`, `readMktConfigAll_`, `mktConfigForMonth_`, `_mktCleanCfgEntry_`, `_mktCheckPass_`, `saveMktChecklistConfig_`, `_mktTagNum_`, `_mktTagRows_`, `buildMktChecklistReport_`
- Hằng/biến: `REPORT_SALE_SS_ID`, `BANNED_WORDS_SHEET_NAME`, `BANNED_WORDS_FALLBACK`, `MKT_DEFAULT_CFG_`, `MKT_MIN_TAGS_`

## 20_ExportLog_AutoAssign.gs
- Hàm: `getExportLogSS_`, `_exportLogGetSheet_`, `_exportLogWriteDays_`, `_dateRangeList_`, `exportDailyReportLogs_`, `chayCaiDatTrigger`, `_aaDefaultCfg`, `_aaSplit`, `_aaRatioFor`, `_aaWeights`, `_aaRecipients`, `_aaBuckets`, `_aaPlan`, `_aaPlanCskh`, `_aaDateOk_`, `_aaPlanAll`, `_aaReadJson_`, `_aaWriteJson_`, `_tierCfgNormalize_`, `_tierCfg_`, `_aaHangKey_`, `_aaLoadCustomers_`, `_aaSetCareCS_`, `autoAssignRun_`, `autoAssignTick_`, `autoAssignRunNow_`, `installAutoAssignTrigger_`, `removeAutoAssignTrigger_`, `caiTriggerChiaTuDong`, `chayThuChiaTuDong`, `goTriggerChiaTuDong`
- Hằng/biến: `EXPORT_LOG_SS_ID`, `EXPORT_LOG_SHEETS_`, `AA_TZ`, `_AA_SRC_KEYS`, `_AA_POS_KEYS`, `_AA_SRC_LABEL`, `_AA_PRIO_KEYS`, `_AA_PRIO_LABEL`, `_AA_TIER`, `_AA_HANG_KEYS`, `_AA_HANG_LABEL`, `_TIER_DEFAULT_`, `_tierCfgMemo_`

## 21_ArchiveOldOrders.gs
- Hàm: `_arcYmd_`, `_arcCutoffYmd_`, `_arcMonths_`, `_arcPickRows_`, `_arcSig_`, `_arcSafeCell_`, `_arcLogRow_`, `_arcOneSheet_`, `archiveOldOrders_`
- Hằng/biến: `ARCHIVE_SUFFIX_`, `ARCHIVE_LOG_SHEET_`, `ARCHIVE_DEFAULT_MONTHS_`, `ARCHIVE_MIN_MONTHS_`, `ARCHIVE_MAX_ROWS_PER_RUN_`, `ARCHIVE_MAX_DELETE_RUNS_`, `ARCHIVE_APPLY_ENABLED_`

## 22_Supabase.gs
- Hàm: `sbCfg_`, `sb_`, `_sbCell_`, `sbCareRowToRec_`, `sbPing_`, `sbPingTick_`, `installSbPingTrigger_`, `caiTriggerSbPing`, `sbBackfillCare_`, `_sbHeader_`, `sbCompareCare_`, `sbMode_`, `sbWriteOn_`, `sbStaleInfo_`, `sbMarkStale_`, `sbDirtyList_`, `sbMarkDirty_`, `_sbInList_`, `_sbUniqByPhone_`, `sbRowsToRecs_`, `sbMirrorCare_`, `sbPatchCare_`, `sbResyncCare_`, `sbStatus_`, `sbSetMode_`, `sbReadSheetRows_`, `sbMirrorSheetRows_`, `sbRecToCareObj_`, `sbReadCare_`, `sbXemTrangThai`, `sbKiemTraKetNoi`, `sbBatGhiSongSong`, `sbBackfillThu`, `sbBackfillThat`, `sbBackfillTuDau`, `sbDoiChieu`, `sbSuaSDTLoi`, `sbTatSupabase`, `sbBatDocSupabase`, `_sbDateIso_`, `_sbRawCell_`, `sbRawToRow_`, `sbDtRowToRec_`, `sbDonRowsToRecs_`, `_sbOrderDef_`, `_sbOpenOrderSheet_`, `_sbGetCursor_`, `sbBackfillOrders_`, `sbBackfillDT_`, `sbBackfillDon_`, `_sbCountTable_`, `_sbFieldEq_`, `sbCompareOrders_`, `sbCompareDT_`, `sbCompareDon_`, `_sbLogBackfill_`, `sbDonHangThuDT`, `sbDonHangDayDT`, `sbDonHangDayLaiTuDauDT`, `sbDonHangDoiChieuDT`, `sbDonHangThuDon`, `sbDonHangDayDon`, `sbDonHangDayLaiTuDauDon`, `sbDonHangDoiChieuDon`, `sbMarkOrdersDirty_`, `_sbHash32_`, `_sbOrdRunAcquire_`, `_sbOrdState_`, `sbSyncOrders_`, `sbOrdersSync_`, `sbOrdersTick_`, `installSbOrdersTrigger_`, `removeSbOrdersTrigger_`, `sbOrdersStatus_`, `_sbLogSync_`, `_sbCareState_`, `sbSyncCare_`, `sbCareTick_`, `installSbCareTrigger_`, `removeSbCareTrigger_`, `sbCareSyncStatus_`, `sbKHDongBo`, `sbKHDongBoLai`, `sbKHCaiTrigger`, `sbKHGoTrigger`, `sbKHTrangThaiDongBo`, `sbDonHangDongBo`, `sbDonHangDongBoLai`, `sbDonHangCaiTrigger`, `sbDonHangGoTrigger`, `sbDonHangTrangThai`, `sbOrdReadOn_`, `_sbOrdReadGate_`, `_sbGetAllRows_`, `_sbGetPagesSeq_`, `sbReadDTTongVals_`, `sbReadOrdersByPhone_`, `sbReadDonByPhone_`, `_sbCareTextToCell_`, `sbReadRemindersRows_`, `sbOrdReadStatus_`, `sbOrdReadEnable_`, `sbOrdReadDisable_`, `sbDonHangBatDoc`, `sbDonHangTatDoc`, `_sbCareListGate_`, `sbReadCareAll_`, `sbReadCareDelta_`, `sbCareListStatus_`, `sbCareListEnable_`, `sbCareListDisable_`, `sbKHDeltaBat`, `sbKHDeltaTat`, `sbKHFullBat`, `sbKHFullTat`, `_sbSetReadOn_`, `_sbSetReadOff_`, `sbSanSangBuoc5_`, `sbSanSangBuoc5`, `_sbBackupState_`, `_sbBackupStamp_`, `_sbBackupFolder_`, `_sbBackupFiles_`, `_sbBackupFetchTable_`, `sbBackup_`, `sbBackupTick_`, `installSbBackupTrigger_`, `removeSbBackupTrigger_`, `sbBackupStatus_`, `sbRestoreBackup_`, `sbSaoLuuSupabase`, `sbSaoLuuLai`, `sbSaoLuuCaiTrigger`, `sbSaoLuuGoTrigger`, `sbSaoLuuTrangThai`, `_sbLogRestore_`, `sbKhoiPhucThu`, `sbKhoiPhucThatCare`, `sbKhoiPhucThatDT`, `sbKhoiPhucThatDon`, `_sbCareKeys_`, `sbPruneCare_`, `sbXoaDongThuaThu`, `sbXoaDongThuaThat`, `_storeCaseShare_`, `_storeCaseVisitDates_`, `_storeCaseReadSheet_`, `_storeCaseBuildCtx_`, `buildStoreCaseReport_`
- Hằng/biến: `SB_BATCH_`, `SB_TIME_BUDGET_MS_`, `SB_CARE_COLS_`, `SB_MIRROR_MAX_`, `SB_DIRTY_MAX_`, `SB_READ_FALLBACK_ON_MISS_`, `SB_DT_COLS_`, `SB_DON_COLS_`, `SB_DT_NUM_`, `SB_ORD_BLOCK_`, `SB_ORD_MAX_BLOCKS_`, `SB_ORD_RUN_TTL_MS_`, `SB_ORD_TICK_MINUTES_`, `SB_CARE_SYNC_BLOCK_`, `SB_CARE_SYNC_MAX_BLOCKS_`, `SB_CARE_SYNC_TICK_MINUTES_`, `SB_ORD_MAX_AGE_MS_`, `SB_PAGE_`, `SB_PAR_`, `SB_CARE_DELTA_MAX_`, `SB_SOAK_DAYS_`, `SB_CARE_MAX_AGE_MS_`, `SB_STEP5_MANUAL_`, `SB_BACKUP_TABLES_`, `SB_BACKUP_PAGE_`, `SB_BACKUP_KEEP_`, `SB_BACKUP_FOLDER_NAME_`, `SB_BACKUP_MAX_AGE_MS_`, `SB_BACKUP_RUN_TTL_MS_`, `SB_BACKUP_STALE_RUN_MS_`, `SB_PRUNE_MAX_ABS_`, `SB_PRUNE_MAX_PCT_`, `SB_PRUNE_GRACE_MS_`, `SB_PRUNE_CHUNK_`, `STORE_CASE_SS_ID_DEFAULT_`

## 23_TodayTasks.gs
- Hàm: `_ttFold_`, `_ttParseVn_`, `_ttSkipSet_`, `_ttBuildRows_`, `ttTrackStages_`, `ttChayNgay`, `ttCaiTrigger`, `_ttStuckFromRows_`, `ttTodayTasks_`
- Hằng/biến: `TT_TRACK_SHEET_`, `TT_TRACK_HEADERS_`, `TT_DEFAULT_HOURS_`, `TT_LOOKBACK_DAYS_`, `TT_REFRESH_MIN_`

## 24_TonKho.gs
- Hàm: `_khoJsonArr_`, `_khoUnames_`, `_khoFromRow_`, `readKho_`, `_khoById_`, `_khoLevel_`, `_khoAllows_`, `_tonkhoCode_`, `_tonkhoKey_`, `_khoNum_`, `_khoNowIso_`, `_khoNewId_`, `_khoAuth_`, `_khoWithLock_`, `_khoGate_`, `_tonkhoItemFromRow_`, `_tonkhoItemToRow_`, `readTonKho_`, `_tonkhoLoad_`, `_tonkhoLog_`, `readTonKhoLog_`, `khoSave_`, `tonKhoSet_`, `tonKhoAdjust_`, `tonKhoItemSave_`, `tonKhoItemDelete_`, `tonKhoImport_`, `_tkdCfg_`, `_tkdCfgSet_`, `readKhoCombo_`, `khoComboSave_`, `_tkdOrderKey_`, `_tkdLooksCombo_`, `_tkdExpandLines_`, `_tkdPickKho_`, `_tkdLedger_`, `_tkdLedgerRow_`, `_tkdRun_`, `tonKhoTruDonStatus_`, `tonKhoTruDonCauHinh_`, `tonKhoTruDonXemTruoc_`, `tonKhoTruDonChay_`, `tonKhoTruDonHoanTay_`, `tonKhoTruDonTick_`, `tonKhoTruDonCaiTrigger`, `tonKhoTruDonGoTrigger`, `tonKhoTruDonXemTruocTay`
- Hằng/biến: `SH_KHO`, `KHO_HEADERS`, `SH_TONKHO`, `TONKHO_HEADERS`, `SH_TONKHO_LOG`, `TONKHO_LOG_HEADERS`, `TONKHO_IMPORT_MAX_`, `SH_KHOCOMBO`, `KHOCOMBO_HEADERS`, `SH_KHOCFG`, `KHOCFG_HEADERS`, `SH_TKD`, `TKD_HEADERS`, `TKD_MAX_QTY_`, `TKD_BATCH_`, `TKD_SYSTEM_USER_`

## 25_PancakeChat.gs
- Hàm: `_pkAuth_`, `_pkEnc_`, `_pkInList_`, `_pkAtts_`, `_pkCacheGet_`, `_pkCachePut_`, `_pkApiGet_`, `_pkTagMap_`, `_pkUserMap_`, `_pkTagsOut_`, `_pkStaffNames_`, `_pkConvOut_`, `_pkMsgOut_`, `_pkMsgs_`, `_pkMarkCrmSender_`, `pkChat_`, `pkChatInbox_`, `pkChatConv_`, `pkChatFind_`, `pkChatLink_`, `_pkPageToken_`, `pkChatSend_`
- Hằng/biến: `PK_CHAT_SECTION_`, `_pkMemo_`, `PK_CONV_COLS_`

## 26_Chat.gs
- Hàm: `_chatAuthErr_`, `_chatUser_`, `_chatNum_`, `_chatLastId_`, `_chatVer_`, `_chatBump_`, `_chatSafeCell_`, `_chatMsgSheet_`, `_chatChSheet_`, `_chatCustomChannels_`, `_chatActiveUsers_`, `_chatAccess_`, `_chatListFor_`, `_chatRec_`, `_chatRingGet_`, `_chatRingPut_`, `_chatTail_`, `_chatSince_`, `chatChannels_`, `chatPoll_`, `chatHistory_`, `chatSend_`, `chatDelete_`, `_chatCleanMembers_`, `chatCreateChannel_`, `chatUpdateChannel_`, `chatDoGet_`, `chatDoPost_`
- Hằng/biến: `SH_CHAT_CH_`, `CHAT_CH_HEADERS_`, `SH_CHAT_MSG_`, `CHAT_MSG_HEADERS_`, `CHAT_MAX_TEXT_`, `CHAT_RING_MAX_`, `CHAT_RATE_MS_`, `CHAT_TAIL_ROWS_`, `CHAT_MAX_MEMBERS_`, `CHAT_GET_ACTIONS_`, `CHAT_POST_ACTIONS_`

## 27_PancakeHistory.gs
- Hàm: `_pkAllPageTokens_`, `_pkIso_`, `_pkPlain_`, `_pkPhoneOfMsg_`, `_pkMapMsg_`, `_pkMapConv_`, `_pkFetchJson_`, `_pkInsertIgnore_`, `_pkFetchMsgs_`, `_pkHistState_`, `_pkHistSave_`, `pkHistSync_`, `pkLichSuThu`, `pkLichSuChay`, `pkLichSuXemTrangThai`, `pkLichSuLamLai`, `pkLichSuTick_`, `_pkUserList_`, `_pkMapStaff_`, `pkStaffSync_`, `pkNhanVienThu`, `pkNhanVienDongBo`, `pkLichSuCaiTrigger`, `removePkLichSuTrigger_`
- Hằng/biến: `PK_HIST_SECTION_`

## 28_StaffProfile.gs
- Hàm: `_profClean_`, `_profFindUser_`, `_profNames_`, `_profRead_`, `_profMetrics_`, `_profCreatorOrders_`, `_profFold_`, `_profScope_`, `_profRank_`, `_profMonthRange_`, `profileGet_`, `profileSave_`, `staffOverview_`
- Hằng/biến: `SH_PROFILE`, `PROFILE_HEADERS`

## 29_MediaLib.gs
- Hàm: `_mlibUser_`, `_mlibSheet_`, `_mlibFolder_`, `_mlibUrl_`, `_mlibClean_`, `_mlibDriveId_`, `_mlibRow_`, `_mlibAppend_`, `mlibList_`, `mlibUpload_`, `mlibAddDrive_`, `mlibSaveTpl_`, `mlibDelete_`, `mlibDoGet_`, `mlibDoPost_`
- Hằng/biến: `SH_MLIB_`, `MLIB_HEADERS_`, `MLIB_TYPES_`, `MLIB_MAX_BYTES_`, `MLIB_GET_ACTIONS_`, `MLIB_POST_ACTIONS_`

## 30_KhDiscuss.gs
- Hàm: `_khdPhone_`, `_khdSheet_`, `_khdMsg_`, `_khdAssignees_`, `_khdLeaderCovers_`, `_khdManagerCovers_`, `_khdUserAllowed_`, `_khdAccess_`, `khdList_`, `khdSend_`, `khdDelete_`, `khdDoGet_`, `khdDoPost_`
- Hằng/biến: `SH_KHD_`, `KHD_HEADERS_`, `KHD_MAX_TEXT_`, `KHD_LIMIT_`, `KHD_TAIL_ROWS_`, `KHD_RATE_MS_`, `KHD_GET_ACTIONS_`, `KHD_POST_ACTIONS_`, `KHD_FORBIDDEN_MSG_`


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
- Hàm: `getSetting_`, `setGasSource_`, `readSaleGroups_`, `saveSaleGroups_`, `_saleGroupLabel_`, `setSetting_`, `_syncSaleChannelsToUsers_`, `addZaloNick_`, `readCareStatus_`, `careObjFromRow_`, `readCare_`, `readCareDelta_`, `findCareByPhone_`, `careRow_`, `readExistingExtFields_`, `mergeExtFields_`, `_legacyReadOrdersUnused_`, `readTeams_`, `readUsers_`, `_secEq_`, `_adminKeyOk_`, `_isSensitiveSettingKey_`, `_isSensitiveWriteKey_`, `_demoToken_`, `_demoTokenOk_`, `_demoSrcOf_`, `_demoClipPerSource_`, `_demoMaskPhone_`, `_demoMaskText_`, `_demoMaskDeep_`, `_demoClip_`, `demoLogin_`
- Hằng/biến: `SALE_GROUPS_DEFAULT_`, `DEMO_MAX_ROWS_`, `DEMO_ALLOWED_GET_`, `DEMO_CLIP_KEYS_`, `DEMO_CLIP_ROWS_ACTIONS_`, `DEMO_PHONE_KEY_RE_`, `DEMO_NOTE_KEY_RE_`, `DEMO_PHONE_STR_RE_`

## 04_doGet.gs
- Hàm: `doGet`, `doGetCore_`

## 05_Orders_DTTong.gs
- Hàm: `buildDashboard_`, `dtRowToOrder_`, `readAllOrders_`, `findDonRowsByPhone_`, `readOrdersByPhone_`, `_stripHonorific_`, `_truncateAtAddressOrDigit_`, `_isPlausibleName_`, `_guessNameCandidatesFromOrderText_`, `_parseNameFromOrderText_`, `_guessNameForPhone_`, `previewCustomerNameGuesses_`, `applyCustomerNameGuesses_`, `getDTSS_`, `_dtCellToVnStr_`, `_vnMidnight_`, `_vnYmd_`, `_vnYmdParts_`, `parseVNDate_`, `_dateStrToVnYmd_`, `dateInRange_`, `_isExcludedOrderStatus_`, `_normMoney_`, `splitMulti_`, `_pancakeKnownSaleNameSet_`, `_expandSaleFilterWithPancakeAliases_`, `_donSaleNamesFromThe_`, `_donHasExcludedStatus_`, `_hiddenPageSaleSets_`, `_isDTRowHidden_`, `readDTTong_`
- Hằng/biến: `DT_SS_ID`, `DT_TONG_SHEET`, `DON_CHITIET_SHEET`, `DON_CHITIET_WIDTH`, `DON_COL_GHICHU`, `DT_COL_NGAYTAO`, `DT_COL_GIAOCHO`, `DT_COL_PHONE`, `DT_COL_GIAIDOAN`, `DT_COL_TRANGTHAI`, `DT_COL_THOIGIANHT`, `DT_COL_KENHBAN`, `DT_COL_SALEBAN`, `DT_COL_SANPHAM`, `DT_COL_PHANLOAI`, `DT_COL_GIATRICOC`, `DT_COL_GIATRIDON`, `DT_COL_GIATRICHENH`, `DT_COL_ID`, `DT_TONG_WIDTH`, `DT_DATE_SENTINEL_`, `NAME_ADDR_KEYWORDS_RE_`, `NAME_MERGE_LABEL_RE_`, `NAME_ALLOWED_CHARS_RE_`, `VN_OFFSET_MS`, `EXCLUDED_ORDER_STATUSES_`, `__pancakeKnownSaleSet_`, `POS_EXTRA_SALE_NAMES_`, `POS_EXCLUDED_ORDER_STATUSES_`

## 06_CSKH_CareLeads_Don.gs
- Hàm: `_findCskhDuyenSheet_`, `_cskhHeaderMap_`, `_cskhCell_`, `readCskhDuyen_`, `_cskhPhoneIndex_`, `findCskhRowsByPhone_`, `findCskhRowsCached_`, `readCskhDuyenLite_`, `_readCskhDuyenLiteBuild_`, `readCareLeads_`, `addCareLead_`, `readDonPhones_`, `getDonSaleByPhone_`, `getDonStatsByPhone_`, `getDonOrderCountByPhone_`, `getDonOrdersByPhone_`, `getDonLastDateByPhone_`, `readDonChiTiet_`, `_sheetByGid_`
- Hằng/biến: `CSKH_DUYEN_SHEET_KEY_`, `CSKH_DUYEN_FIELDS_`

## 07_SalesReportA.gs
- Hàm: `getSalesReportOptions_`, `_dtIsExchangeOrder_`, `_dtOrderRevenue_`, `_srCloseRateSections_`, `_extractPageIdFromNguonDon_`, `_extractPageNameFromNguonDon_`, `buildSalesReportA_`

## 08_SaleKPI_FailedOrders.gs
- Hàm: `readSaleKpiConfig_`, `_ymAdd_`, `_ymMonthsBetween_`, `_ymFirstDay_`, `_ymLastDay_`, `_todayYm_`, `_computeSaleMonthlyRevenue_`, `_computeSaleTierTimeline_`, `buildSaleKpiReport_`, `buildFailedOrderReport_`
- Hằng/biến: `SALE_TIER_ORDER_`, `SALE_TIER_DEFAULT_TARGETS_`, `SALE_TIER_META_`, `SALE_KPI_DEFAULT_CFG_`

## 09_SalesReportB_POS.gs
- Hàm: `_normCounterCode_`, `_counterCodeNoYear_`, `_counterCodeHasYear_`, `_extractCounterCodes_`, `_detectBaseCounterCol_`, `_readBaseRowsByCounterCodes_`, `_pickBaseRowsForCode_`, `_resolveGhepDon_`, `_quaySaleRatio_`, `_foldSaleKey_`, `_resolveBonusSale_`, `buildSalesReportB_`
- Hằng/biến: `POS_GHEP_BASE_ENABLED_`, `COUNTER_CODE_INNER_`, `COUNTER_CODE_RE_SRC_`, `QUAY_SALE_RATIO_`

## 10_CSStats_KPI_ReportC.gs
- Hàm: `_csJsonSetting_`, `_csYmdFromDmy_`, `_csDaysSinceStart_`, `_csBonusProductQty_`, `_csBonusApplies_`, `_csRequireProductOk_`, `_csMoney_`, `_csBonusSummary_`, `buildCsStats_`, `ensureKPISheet_`, `readKPITargets_`, `getKPI_`, `_getMonday_`, `_isoWeekRange_`, `_isoWeekKey_`, `_monthRange_`, `_monthKey_`, `_quarterRange_`, `_yearRange_`, `_yearKey_`, `_quarterKey_`, `_ymdLocal_`, `_labelVN_`, `_resolvePeriods_`, `buildSalesReportC_`, `buildCareLeadReport_`
- Hằng/biến: `CS_COMMISSION_THRESHOLD_`, `KPI_SHEET`

## 11_ExportSheet_doPost.gs
- Hàm: `exportSalesReportToSheet_`, `doPost`, `doPostCore_`

## 12_SaveCare_Orders_Dedupe.gs
- Hàm: `invalidateLookupCache_`, `saveAllCare_`, `saveSingleCare_`, `saveBatchCare_`, `syncZaloFriendStatus_`, `saveOrders_`, `patchOrder_`, `deleteOrder_`, `normOrderDate_`, `_normTxt_`, `findDuplicateOrders_`, `deleteDuplicateOrders_`, `_rowKeyExact_`, `_rowIsBlank_`, `_autoDedupExactRowsInSheet_`, `_autoDedupLog_`, `onChangeDedupTrigger_`, `installAutoDedupTrigger_`, `_impHm_`, `_impOrderKey_`, `doImportSheetRows_`, `doImportSheetRowsLocked_`, `replaceOrders_`, `setOrderCareCS_`, `setOrderCareCSBatch_`
- Hằng/biến: `SH_AUTO_DEDUP_LOG`, `AUTO_DEDUP_LOG_HEADERS`

## 13_Teams_Pancake.gs
- Hàm: `saveTeams_`, `readMktTeams_`, `saveMktTeams_`, `_mktPageWeights_`, `_mktKenhWeights_`, `savePancakeStats_`, `readPancakeMapCI_`, `readPancakeMap_`, `pancakeAllNames_`, `savePancakeNameMap_`, `_pkStatsRowsMemo_`, `buildPancakeReport_`, `savePancakeSdtStats_`, `buildPancakeSdtReport_`, `readPancakePageMap_`, `readPancakePageMapByName_`, `pancakeAllPages_`, `savePancakePageMap_`, `classifyPancakeTag_`, `savePancakeTagStats_`, `buildPancakeTagReport_`, `_tagFunnelRates_`, `_pkSheetDateSpan_`, `saveSaleDirectory_`, `readSaleDirectory_`, `_pkTrackedDatesByPageAndSale_`, `_sumOrdersOnDates_`
- Hằng/biến: `_pkStatsRowsMemoCache_`, `_pkReportMemoCache_`, `PK_STATUS_CODES_`, `SALE_DIR_HEADERS`

## 14_KpiReport_Users_Assign.gs
- Hàm: `buildKpiReport_`, `saveUsers_`, `saveAudit_`, `saveCareStatus_`, `readAssign_`, `assignRowsOf_`, `saveAssignEntry_`, `toggleAssignDone_`, `saveAssignHistory_`, `readAIContext_`, `_pwHash_`, `verifyLogin_`, `saveAIContext_`
- Hằng/biến: `_PW_SALT_`, `_PW_SALT_OLD_`

## 15_ProductSheets_Drive.gs
- Hàm: `_psheetNoAccent_`, `_careMapByPhone_`, `_pMatchAny_`, `_foldTermsCSV_`, `_productSheetIndexForTab_`, `readFaqSheet_`, `readExternalProductSheet_`, `callGroqAI_`, `_driveFolderIdFromUrl_`, `_chunkText_`, `_driveKnowFullTextCacheKey_`, `_cacheDriveKnowFullText_`, `_extractPdfText_`, `_driveKnowChunkText_`, `_driveKnowledgeFileIndex_`, `readDriveKnowledgeFolder_`, `_driveImageIndex_`, `_driveImageFromLink_`, `findProductSheetImage_`, `findDriveProductImage_`, `_driveImageBase64_`
- Hằng/biến: `_PSHEET_STOPWORDS_`, `_DRIVE_IMG_MAX_BYTES_`

## 16_BannedWords_AI.gs
- Hàm: `readBannedWordsList_`, `_bannedWordsPromptBlock_`, `_buildAISystemPrompt_`, `_aiOpenAICompat_`, `_aiGemini_`, `callAI_`, `_maskKey_`, `diagApiKeys`, `testScript`
- Hằng/biến: `BANNED_WORDS_SS_ID`, `BANNED_WORDS_GID`

## 17_Broadcast_FollowUp.gs
- Hàm: `getBroadcastSheet_`, `readBroadcasts_`, `saveBroadcast_`, `broadcastMark_`, `broadcastQueueForCS_`, `uploadBroadcastImage_`, `broadcastSetStatus_`, `broadcastCancel_`, `fuSourceAllowed_`, `readProductCodeMapFromSheet_`, `getProductCodeMap_`, `productCodeFromText_`, `readFollowUpTemplates_`, `listFollowUpTemplates_`, `saveFollowUpTemplates_`, `renderFollowUpTemplate_`, `readFollowUpLogKeys_`, `appendFollowUpLogRows_`, `readZaloScanByPhone_`, `dedupeCare_`, `runDedupeCare`, `saveZaloScan_`, `runFollowUpScan_`, `runFollowUpScanTrigger`
- Hằng/biến: `SH_BROADCAST`, `BROADCAST_HEADERS`, `BROADCAST_FOLDER_ID`, `SH_FU_TEMPLATE`, `FU_TEMPLATE_HEADERS`, `SH_FU_LOG`, `FU_LOG_HEADERS`, `SH_ZALO_SCAN`, `ZALO_SCAN_HEADERS`, `FU_CHECKPOINTS`, `FU_START`, `FU_SOURCES`, `PRODUCT_CODE_MAP_`, `_productCodeMapCache_`

## 18_Tasks_Menh_MsgTpl.gs
- Hàm: `readTasks_`, `saveTaskEntry_`, `deleteTask_`, `readTaskComments_`, `saveTaskComment_`, `menhFromYear_`, `buildMenhRows_`, `ensureMenhSheedSeeded_`, `ensureCannedSheetSeeded_`, `getMessengerKnowledge_`, `_aiExId_`, `readAIExamples_`, `saveAIExample_`, `deleteAIExample_`, `saveCannedResponse_`, `deleteCannedResponse_`, `readMessageTemplates_`, `saveMessageTemplate_`, `deleteMessageTemplate_`
- Hằng/biến: `SH_TASK`, `TASK_HEADERS`, `SH_TASK_COMMENT`, `TASK_COMMENT_HEADERS`, `SH_MENH`, `SH_CANNED`, `MENH_DEFAULT_ROWS`, `MENH_SHEET_MARK`, `CANNED_DEFAULT_ROWS`, `SH_MSG_TPL`, `MSG_TPL_HEADERS`

## 19_BannedList_MktChecklist.gs
- Hàm: `readBannedWords_`, `_mktMonthOf_`, `readMktConfigAll_`, `mktConfigForMonth_`, `_mktCleanCfgEntry_`, `_mktCheckPass_`, `saveMktChecklistConfig_`, `_mktTagNum_`, `_mktTagRows_`, `buildMktChecklistReport_`
- Hằng/biến: `REPORT_SALE_SS_ID`, `BANNED_WORDS_SHEET_NAME`, `BANNED_WORDS_FALLBACK`, `MKT_DEFAULT_CFG_`, `MKT_MIN_TAGS_`

## 20_ExportLog_AutoAssign.gs
- Hàm: `getExportLogSS_`, `_exportLogGetSheet_`, `_exportLogWriteDays_`, `_dateRangeList_`, `exportDailyReportLogs_`, `chayCaiDatTrigger`, `_aaDefaultCfg`, `_aaSplit`, `_aaRatioFor`, `_aaWeights`, `_aaRecipients`, `_aaBuckets`, `_aaPlan`, `_aaPlanCskh`, `_aaPlanAll`, `_aaReadJson_`, `_aaWriteJson_`, `_aaHangKey_`, `_aaLoadCustomers_`, `_aaSetCareCS_`, `autoAssignRun_`, `autoAssignTick_`, `autoAssignRunNow_`, `installAutoAssignTrigger_`, `removeAutoAssignTrigger_`, `caiTriggerChiaTuDong`, `chayThuChiaTuDong`, `goTriggerChiaTuDong`
- Hằng/biến: `EXPORT_LOG_SS_ID`, `EXPORT_LOG_SHEETS_`, `AA_TZ`, `_AA_SRC_KEYS`, `_AA_POS_KEYS`, `_AA_SRC_LABEL`, `_AA_PRIO_KEYS`, `_AA_PRIO_LABEL`, `_AA_TIER`, `_AA_HANG_KEYS`, `_AA_HANG_LABEL`


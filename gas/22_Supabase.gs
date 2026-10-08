// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE (Postgres) — BUOC 2/5 cua docs/SUPABASE-PLAN.md. CHUA doi lookup/saveSingle (khong anh huong extension).
//  Cau hinh: Apps Script -> Project Settings -> Script Properties: SUPABASE_URL (https://xxxx.supabase.co) va
//  SUPABASE_KEY (service_role). KHONG luu key trong Settings sheet / code / chat (Settings sheet de CRM doc duoc).
//  Cac action Supabase deu can adminKey. Backfill chay lap lai den khi done=true (moi lan toi da ~4 phut, con tro o Script Properties).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_BATCH_ = 500;
var SB_TIME_BUDGET_MS_ = 240000;   // Apps Script cat o 6 phut — dung 4 phut roi tra ve de goi lai
var SB_CARE_COLS_ = ['phone','status','zalo','cs','note','schedules','sched_goi','sched_goi_note','sched_sp','sched_sp_note',
  'sched_cs','sched_cs_note','sched_hen','sched_hen_note','updated','kh_status','nick_zalos','birthday','zalo_set_by','name','custom','zalo_phones'];
// Thu tu PHAI giong CARE_HEADERS (22 cot) va supabase/schema.sql — sbCareRowToRec_ map theo vi tri.

function sbCfg_() {
  var pr = PropertiesService.getScriptProperties();
  var url = String(pr.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  var key = String(pr.getProperty('SUPABASE_KEY') || '');
  return { url: url, key: key, ok: !!(url && key) };
}

// Goi REST Supabase. Tra { code, text, json, headers }. Nem loi (KHONG kem key) neu HTTP >= 300.
function sb_(method, path, body, extraHeaders) {
  var cfg = sbCfg_();
  if (!cfg.ok) throw new Error('Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.');
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var k;
  if (extraHeaders) for (k in extraHeaders) headers[k] = extraHeaders[k];
  var opt = { method: method, headers: headers, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined && body !== null) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, opt);
  var code = res.getResponseCode(), text = res.getContentText() || '';
  if (code >= 300) throw new Error('Supabase HTTP ' + code + ' (' + method + ' ' + String(path).split('?')[0] + '): ' + text.slice(0, 300));
  var json = null;
  if (text) { try { json = JSON.parse(text); } catch (eJ) {} }
  return { code: code, text: text, json: json, headers: res.getAllHeaders ? res.getAllHeaders() : {} };
}

function _sbCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}

// 1 dong sheet CareData (mang 22 o) -> object cot Supabase. null neu khong co SDT hop le.
function sbCareRowToRec_(row) {
  var phone = normPhone_(_sbCell_(row[0]));
  if (!phone) return null;
  var rec = {};
  for (var i = 0; i < SB_CARE_COLS_.length; i++) rec[SB_CARE_COLS_[i]] = _sbCell_(row[i]);
  rec.phone = phone;
  if (!rec.nick_zalos) rec.nick_zalos = '[]';
  if (!rec.zalo_phones) rec.zalo_phones = '[]';
  var d = rec.updated ? new Date(rec.updated) : null;
  rec.updated_at = (d && !isNaN(d.getTime())) ? d.toISOString() : new Date().toISOString();
  return rec;
}

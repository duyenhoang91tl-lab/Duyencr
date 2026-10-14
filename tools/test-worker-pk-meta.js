// Test chat Pancake o che do Worker doc thang Supabase (PK_NATIVE=1): dong bo voi GAS — gv, tagN, thu tu ten nguoi gui (crm_user > staff_name > raw.from.admin_name).
// Chay: node tools/test-worker-pk-meta.js
const path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'worker.mjs')).href);
  let ok = 0, fail = 0; const t = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); v ? ok++ : fail++; };
  const c = mod.pkConvOut({ id: 'C', page_id: 'P', tags: [26, -99], assignee_ids: [] }, {}, { 'P:26': { t: 'L1. Chuan', c: '#009344' } });
  t('tagN = so the da luu (ke ca ma khong co ten); tags chi gom the co ten', c.tagN === 2 && c.tags.length === 1 && c.tags[0].t === 'L1. Chuan');
  const m = o => mod.pkMsgOut(Object.assign({ id: 'm', conversation_id: 'C', direction: 'out', text: 'x', sent_at: '2026-10-12T01:00:00Z', sender_name: 'Page', fromraw: { admin_name: 'FromRaw' } }, o));
  t('staff: crm_user > staff_name > raw.from.admin_name', m({ crm_user: 'Duyen', staff_name: 'Hoc' }).staff === 'Duyen' && m({ staff_name: 'Hoc' }).staff === 'Hoc' && m({}).staff === 'FromRaw');
  t('tin khach: khong co staff (khong lot crm_user/staff_name)', m({ direction: 'in', staff_name: 'Hoc', crm_user: 'Duyen' }).staff === '');
  const calls = [];
  globalThis.fetch = async (u) => { calls.push(String(u)); return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const env = { SUPABASE_URL: 'https://sb.example.supabase.co', SUPABASE_SERVICE_KEY: 'k' };
  const r = await mod.pkChatRun('pkChatConv', new URLSearchParams({ conv: 'C' }), env);
  t('Worker native tra gv (de client khong bao "GAS cu")', r.ok === true && r.gv === 'worker-native');
  t('truy van tin chon crm_user + staff_name', calls.some(u => u.includes('pk_messages') && decodeURIComponent(u).includes('crm_user,staff_name')));
  const r2 = await mod.pkChatRun('pkChatInbox', new URLSearchParams({ q: '' }), env);
  t('hop thu native cung tra gv', r2.ok === true && r2.gv === 'worker-native');
  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

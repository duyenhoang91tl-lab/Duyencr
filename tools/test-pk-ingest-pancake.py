# Test tach payload THAT cua Pancake (cau truc lay tu webhook that 2026-10-12, ten/id da thay gia). Can: pip install pgserver
# Chay: python3 tools/test-pk-ingest-pancake.py -> "PANCAKE INGEST OK"
import pgserver, subprocess, json, glob, sys, tempfile, os
db = pgserver.get_server(tempfile.mkdtemp())
uri = db.get_uri()
psql = glob.glob('/usr/**/pgserver/pginstall/bin/psql', recursive=True)[0]
def run(sql, tuples=False):
    a = [psql, uri, '-v', 'ON_ERROR_STOP=1', '-q', '-X'] + (['-At'] if tuples else [])
    r = subprocess.run(a + ['-c', sql], capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit(1)
    return r.stdout.strip()
base = open(os.path.join(os.path.dirname(__file__), '..', 'supabase', 'schema.sql'), encoding='utf-8').read()
# bang pk_webhook_raw o dang TAO TAY thieu cot (loi that da gap) -> schema phai tu bo sung
run("create table pk_webhook_raw(id bigserial primary key, payload jsonb, created_at timestamptz default now());")
open('/tmp/_s.sql', 'w', encoding='utf-8').write(base[base.index('-- 7) pk_webhook_raw'):])
for i in (1, 2):
    r = subprocess.run([psql, uri, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q', '-X', '-f', '/tmp/_s.sql'], capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit(1)
PAGE, PSID, CUST = '1000000000000001', '2000000000000002', 'aaaaaaaa-0000-0000-0000-000000000001'
CONV = PAGE + '_' + PSID
def conv(ass, ver=None, tags=None, seen=False):
    c = {"id": CONV, "from": {"id": PSID, "name": "Khach Test"}, "seen": seen, "tags": tags or [], "type": "INBOX", "snippet": "Minh muon tu van", "is_removed": False, "is_replied": False, "customer_id": CUST, "assignee_ids": ass}
    if ver is not None: c["version"] = ver
    return c
def msg(mid, frm, text, ins, phone_info=None):
    return {"id": mid, "from": {"id": frm, "name": "N"}, "type": "INBOX", "message": "<div>" + text + "</div>", "page_id": PAGE, "conversation_id": CONV,
            "inserted_at": ins, "original_message": text, "phone_info": phone_info or [], "attachments": []}
def ins(p):
    run("insert into pk_webhook_raw(page_id, event_type, payload) values ('%s','%s','%s'::jsonb);" % (p.get('page_id', ''), p.get('event_type', ''), json.dumps(p).replace("'", "''")))
# 1) tin he thong tu page (nhu mau that) + conversation nhung (assignee cu, khong version)
ins({"data": {"post": None, "message": msg("m_sys1", PAGE, "Khach Test da tra loi mot quang cao.", "2026-10-11T20:24:23.000000"), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791750268, "event_type": "messaging"})
# 2) su kien conversation moi hon (version 109) -> thang ve assignee/tags
ins({"data": {"conversation": conv(["B-new"], 109, [{"id": 7, "text": "VIP"}], seen=True)}, "page_id": PAGE, "timestamp": 1791750269, "event_type": "conversation"})
# 3) su kien conversation CU den tre (version 100) -> khong duoc lam lui
ins({"data": {"conversation": conv(["C-stale"], 100, [])}, "page_id": PAGE, "timestamp": 1791750100, "event_type": "conversation"})
# 4) tin KHACH nhan, co SDT trong noi dung (nhieu dang), + gui trung lan 2 (khong nhan doi)
cm = {"data": {"post": None, "message": msg("m_cus1", PSID, "Chi can tu van, sdt 0912.345.678 nhe", "2026-10-11T20:30:00.000000"), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791750600, "event_type": "messaging"}
ins(cm); ins(cm)
# 5) tin page tra loi co SDT cua page -> KHONG duoc gan cho khach
ins({"data": {"post": None, "message": msg("m_out1", PAGE, "Dạ em goi 0988777666 nhe", "2026-10-11T20:31:00.000000"), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791750660, "event_type": "messaging"})
# 6) bai dang / su kien la -> bo qua nhung van luu tho, khong loi
ins({"data": {"post": {"id": "p1"}}, "page_id": PAGE, "timestamp": 1791750700, "event_type": "post"})
ins({"data": "khong-phai-object", "page_id": PAGE, "event_type": "messaging"})
errs = run("select count(*) from pk_webhook_raw where process_error <> '' ", True)
assert errs == '0', 'co process_error: ' + run("select id, process_error from pk_webhook_raw where process_error <> ''", True)
assert run("select count(*) from pk_webhook_raw where processed_at is null", True) == '0', 'dong chua danh dau da xu ly'
assert run("select count(*) from pk_conversations", True) == '1', 'phai gop vao 1 hoi thoai'
row = run("select assignee_ids, tags->0->>'text', seen, version, customer_name, customer_id, psid, customer_phone from pk_conversations", True)
assert row == '{B-new}|VIP|t|109|Khach Test|%s|%s|0912345678' % (CUST, PSID), 'conversation sai: ' + row
msgs = run("select id||','||direction||','||sent_at at time zone 'UTC' from pk_messages order by sent_at", True).split('\n')
assert msgs == ['m_sys1,out,2026-10-11 20:24:23', 'm_cus1,in,2026-10-11 20:30:00', 'm_out1,out,2026-10-11 20:31:00'], msgs
assert run("select last_text from pk_conversations", True).startswith('Dạ em goi'), 'last_text phai la tin moi nhat'
# phone_info co gia tri -> uu tien phone_info, dang +84
ins({"data": {"post": None, "message": msg("m_cus2", PSID, "alo", "2026-10-11T21:00:00.000000", ["+84 901 234 567"]), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791752000, "event_type": "messaging"})
assert run("select customer_phone from pk_conversations", True) == '0912345678', 'SDT da co khong bi ghi de'
# tach lai toan bo: idempotent, khong nhan doi
assert int(run("select pk_reprocess_raw()", True)) >= 8
assert run("select count(*) from pk_messages", True) == '4' and run("select count(*) from pk_conversations", True) == '1', 'reprocess lam nhan doi'
# anon khong duoc goi ham (neu role ton tai trong DB that); o day chi kiem tra RLS bat + khong policy
assert run("select count(*) from pg_policies where tablename like 'pk_%'", True) == '0', 'khong duoc co policy'
assert run("select bool_and(relrowsecurity) from pg_class where relname in ('pk_webhook_raw','pk_conversations','pk_messages')", True) == 't', 'RLS phai bat'
print('PANCAKE INGEST OK')

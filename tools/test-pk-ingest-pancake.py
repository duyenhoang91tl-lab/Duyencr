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
# 8) MAU THAT 2026-10-13 (da an danh): khach nhan co SDT -> phone_info la MANG OBJECT {captured, phone_number, status...}; tags la MANG MA SO NGUYEN [109] (khong phai object)
CONV2 = PAGE + '_3000000000000003'
real = {"data": {"post": None, "message": {"id": "m_real1", "from": {"id": "3000000000000003", "name": "Khach Hai", "page_customer_id": "x"}, "type": "INBOX",
        "message": "<div>Sdt test <Copy key='9' text='0378996789'><span class='phone-tag'>0378996789</span></Copy></div>", "page_id": PAGE, "has_phone": True,
        "phone_info": [{"m_id": "m_real1", "length": 10, "offset": 9, "status": 2, "captured": "0378996789", "phone_number": "0378996789"}],
        "attachments": [], "inserted_at": "2026-10-13T16:49:36.000000", "original_message": "Sdt test 0378996789", "conversation_id": CONV2},
        "conversation": {"id": CONV2, "from": {"id": "3000000000000003", "name": "Khach Hai"}, "seen": False, "tags": [109], "type": "INBOX", "snippet": "Sdt test 0378996789",
        "is_replied": False, "customer_id": "bbbbbbbb-0000-0000-0000-000000000002", "assignee_ids": ["58c72913-aaaa"]}}, "page_id": PAGE, "timestamp": 1791910181, "event_type": "messaging"}
ins(real)
r = run("select customer_phone||'|'||tags::text||'|'||assignee_ids::text||'|'||snippet from pk_conversations where id = '%s'" % CONV2, True)
assert r == '0378996789|[109]|{58c72913-aaaa}|Sdt test 0378996789', 'mau that: ' + r
assert run("select direction||'|'||text from pk_messages where id = 'm_real1'", True) == 'in|Sdt test 0378996789', 'tin khach co SDT sai huong/noi dung'
# phone_info co gia tri -> uu tien phone_info, dang +84
ins({"data": {"post": None, "message": msg("m_cus2", PSID, "alo", "2026-10-11T21:00:00.000000", ["+84 901 234 567"]), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791752000, "event_type": "messaging"})
assert run("select customer_phone from pk_conversations where id = '%s'" % CONV, True) == '0912345678', 'SDT da co khong bi ghi de'
# tach lai toan bo: idempotent, khong nhan doi
n_msgs = int(run("select count(*) from pk_messages", True)); n_convs = int(run("select count(*) from pk_conversations", True))
assert int(run("select pk_reprocess_raw()", True)) >= 9
assert run("select count(*) from pk_messages", True) == str(n_msgs) and run("select count(*) from pk_conversations", True) == str(n_convs), 'reprocess lam nhan doi'
# staff_name: tin 'out' lay ten nhan vien tu conversation.last_sent_by (neu webhook kem theo); tin khach thi rong; webhook gui lai khong kem ten khong xoa ten da biet
cs = conv(["A-old"]); cs["last_sent_by"] = {"admin_id": "570423649807405", "admin_name": "Le Ninh", "id": PAGE, "name": "Page"}
ins({"data": {"post": None, "message": msg("m_out2", PAGE, "Da em gui chi nhe", "2026-10-11T21:30:00.000000"), "conversation": cs}, "page_id": PAGE, "timestamp": 1791753000, "event_type": "messaging"})
assert run("select staff_name from pk_messages where id='m_out2'", True) == 'Le Ninh', 'tin out phai co staff_name tu last_sent_by'
assert run("select staff_name from pk_messages where id='m_cus1'", True) == '', 'tin khach khong co staff_name'
assert run("select staff_name from pk_messages where id='m_out1'", True) == '', 'tin out cu (payload khong co last_sent_by) khong bi gan nham'
ins({"data": {"post": None, "message": msg("m_out2", PAGE, "Da em gui chi nhe (sua)", "2026-10-11T21:30:00.000000"), "conversation": conv(["A-old"])}, "page_id": PAGE, "timestamp": 1791753100, "event_type": "messaging"})
assert run("select staff_name||'|'||text from pk_messages where id='m_out2'", True) == 'Le Ninh|Da em gui chi nhe (sua)', 'gui lai khong kem ten phai giu ten cu va cap nhat noi dung'
cm2 = conv(["A-old"]); cm2["last_sent_by"] = {"admin_name": "Nguoi Khac"}
ins({"data": {"post": None, "message": msg("m_cus9", PSID, "tin khach", "2026-10-11T21:40:00.000000"), "conversation": cm2}, "page_id": PAGE, "timestamp": 1791753200, "event_type": "messaging"})
assert run("select staff_name from pk_messages where id='m_cus9'", True) == '', 'tin khach KHONG lay last_sent_by'
# anon khong duoc goi ham (neu role ton tai trong DB that); o day chi kiem tra RLS bat + khong policy
assert run("select count(*) from pg_policies where tablename like 'pk_%'", True) == '0', 'khong duoc co policy'
assert run("select bool_and(relrowsecurity) from pg_class where relname in ('pk_webhook_raw','pk_conversations','pk_messages')", True) == 't', 'RLS phai bat'
# ── MAU THAT 2026-10-13 (nguoi dung gui de kiem chung): tags[] la mang SO NGUYEN (ma the), phone_info[] la
# mang OBJECT {m_id,length,offset,status,captured,phone_number}, HTML tin co <Copy><span class='phone-tag'>.
# Cau truc giu NGUYEN, chi thay gia ten/id/SDT. Truoc do test chi dung phone_info rong/dang chuoi va tags dang object.
PAGE2, PSID2, CUST2 = '3000000000000003', '40000000000000004', 'bbbbbbbb-0000-0000-0000-000000000002'
CONV2 = PAGE2 + '_' + PSID2
MID2, PH2 = 'm_REALSAMPLE1', '0907654321'
real_msg = {"id": MID2, "from": {"id": PSID2, "name": "Khach Mau That", "email": PSID2 + "@facebook.com", "ai_generated": False, "page_customer_id": CUST2},
            "type": "INBOX", "message": "<div>Sdt test <Copy key='9' id='" + MID2 + "_" + PH2 + "' text='" + PH2 + "'><span class='phone-tag phone-tag-trusted' key='9.1'>" + PH2 + "</span></Copy></div>",
            "page_id": PAGE2, "can_hide": False, "can_like": False, "has_phone": True, "is_hidden": False, "is_parent": False, "parent_id": None, "show_info": True,
            "can_remove": False, "is_removed": False, "like_count": None,
            "phone_info": [{"m_id": MID2, "length": 10, "offset": 9, "status": 2, "captured": PH2, "phone_number": PH2}],
            "removed_by": None, "updated_at": "2026-10-13T16:49:41.083355", "user_likes": False, "attachments": [], "can_comment": False,
            "inserted_at": "2026-10-13T16:49:36.000000", "edit_history": None, "rich_message": None, "conversation_id": CONV2, "is_parent_hidden": False,
            "original_message": "Sdt test " + PH2, "can_reply_privately": False, "private_reply_conversation": None}
real_conv = {"id": CONV2, "from": {"id": PSID2, "name": "Khach Mau That", "email": PSID2 + "@facebook.com"}, "seen": False, "tags": [109], "type": "INBOX",
             "snippet": "Sdt test " + PH2, "is_removed": False, "is_replied": False, "customer_id": CUST2, "is_combined": False,
             "assignee_ids": ["cccccccc-0000-0000-0000-000000000003"],
             "read_watermarks": [{"psid": PSID2, "watermark": 1791909785, "message_id": "m_REALSAMPLE0", "is_group_conv": None}]}
ins({"data": {"post": None, "message": real_msg, "conversation": real_conv}, "page_id": PAGE2, "timestamp": 1791910181, "event_type": "messaging", "request_id": "00000000-0000-0000-0000-00000000000a"})
assert run("select customer_phone from pk_conversations where id='%s'" % CONV2, True) == PH2, 'mau that: SDT phai lay tu phone_info (object phone_number)'
assert run("select tags::text from pk_conversations where id='%s'" % CONV2, True) == '[109]', 'mau that: tags la mang SO NGUYEN, phai luu nguyen ven'
assert run("select assignee_ids::text from pk_conversations where id='%s'" % CONV2, True) == '{cccccccc-0000-0000-0000-000000000003}', 'mau that: assignee_ids'
assert run("select seen::text||'|'||customer_id||'|'||psid from pk_conversations where id='%s'" % CONV2, True) == 'false|%s|%s' % (CUST2, PSID2), 'mau that: seen/customer_id/psid'
assert run("select direction||'|'||to_char(sent_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')||'|'||text from pk_messages where id='%s'" % MID2, True) == 'in|2026-10-13 16:49:36|Sdt test ' + PH2, 'mau that: huong/gio/noi dung tin'
# SDT CHI co trong phone_info (text khong co so nao) -> van phai nhan tu object phone_info, khong chi nho regex tren text
PSID3, PH3 = '50000000000000005', '0908111222'
CONV3 = PAGE2 + '_' + PSID3
mB = dict(real_msg); mB.update({"id": "m_REALSAMPLE2", "from": dict(real_msg["from"], id=PSID3), "conversation_id": CONV3, "message": "<div>Sdt em day a</div>", "original_message": "Sdt em day a",
                               "phone_info": [{"m_id": "m_REALSAMPLE2", "length": 10, "offset": 11, "status": 2, "captured": PH3, "phone_number": PH3}], "inserted_at": "2026-10-13T16:50:00.000000"})
cB = dict(real_conv, id=CONV3, tags=[], snippet="Sdt em day a"); cB["from"] = dict(real_conv["from"], id=PSID3)
ins({"data": {"post": None, "message": mB, "conversation": cB}, "page_id": PAGE2, "timestamp": 1791910200, "event_type": "messaging"})
assert run("select customer_phone from pk_conversations where id='%s'" % CONV3, True) == PH3, 'SDT chi co o phone_info (text khong co so) van phai nhan duoc'
print('PANCAKE INGEST OK')

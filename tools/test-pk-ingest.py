# Test supabase/schema.sql muc 7+8 (tach tin Pancake) tren Postgres that: pip install pgserver; python3 tools/test-pk-ingest.py
import pgserver, json, re, sys
db = pgserver.get_server('/tmp/pgdata')
def q(sql): return db.psql(sql)
base = open('supabase/schema.sql', encoding='utf-8').read()
# chỉ cần các bảng pk_webhook_raw (mục 7) + mục 8
i7 = base.index('-- 7) pk_webhook_raw'); sql = base[i7:]
# giả lập policy cũ tạo tay (như bản user đã chạy)
pre = "create table if not exists pk_webhook_raw(id bigint generated always as identity primary key, received_at timestamptz not null default now(), page_id text default '', event_type text default '', payload jsonb not null);"
print(q(pre))
for n in (1, 2):   # chạy 2 lần: idempotent
    r = q(sql); print('run', n, 'ERROR' if 'ERROR' in str(r) else 'ok'); 
    if 'ERROR' in str(r): print(r)
msg = {"event_type":"messaging","page_id":"100012345678901","entry":[{"id":"100012345678901","time":1718000000000,"messaging":[{"sender":{"id":"fb_customer_987654321","name":"Nguyễn Văn A"},"recipient":{"id":"100012345678901"},"timestamp":1718000000000,"message":{"mid":"m_mid.1","text":"Tư vấn giúp mình vòng tay phong thủy mệnh Kim nhé"}}]}]}
reply = json.loads(json.dumps(msg)); m = reply['entry'][0]['messaging'][0]
m['sender'], m['recipient'] = {"id":"100012345678901"}, {"id":"fb_customer_987654321","name":"Nguyễn Văn A"}
m['timestamp'] = 1718000060000; m['message'] = {"mid":"m_mid.2","text":"Dạ chị ơi","is_echo":True}
def ins(p): q("insert into pk_webhook_raw(page_id,event_type,payload) values ('x','y','%s'::jsonb);" % json.dumps(p).replace("'", "''"))
ins(msg); ins(msg)            # trùng -> không nhân đôi
ins(reply)
ins({"event_type":"conversation","weird":[1,2]})   # dạng lạ -> không lỗi, vẫn lưu thô
ins({"entry":"khong-phai-mang","x":1})
print(q("select id, processed_at is not null as ok, process_error from pk_webhook_raw order by id;"))
print(q("select id, customer_name, last_text, last_message_at from pk_conversations;"))
print(q("select id, direction, sender_id, sent_at from pk_messages order by sent_at;"))

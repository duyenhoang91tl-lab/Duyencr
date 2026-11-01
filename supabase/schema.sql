-- Duyên AI CRM — schema Postgres (Supabase) — BƯỚC 1/4 của docs/SUPABASE-PLAN.md
-- Chạy trong Supabase → SQL Editor. Idempotent (chạy lại không lỗi).
-- Nguyên tắc: giữ 1-1 với cột Google Sheet để backfill/đối chiếu dễ; phone luôn là SĐT đã chuẩn hoá (normPhone_).

-- 1) care_data  <=> sheet CareData (CARE_HEADERS, 22 cột). Khoá chính = phone.
create table if not exists care_data (
  phone          text primary key,            -- normPhone_()
  status         text default '',
  zalo           text default '',
  cs             text default '',
  note           text default '',
  schedules      text default '',
  sched_goi      text default '',
  sched_goi_note text default '',
  sched_sp       text default '',
  sched_sp_note  text default '',
  sched_cs       text default '',
  sched_cs_note  text default '',
  sched_hen      text default '',
  sched_hen_note text default '',
  updated        text default '',             -- giữ nguyên chuỗi như Sheet (readCareDelta_ so sánh theo chuỗi)
  kh_status      text default '',
  nick_zalos     text default '[]',
  birthday       text default '',
  zalo_set_by    text default '',
  name           text default '',
  custom         text default '',
  zalo_phones    text default '[]',
  updated_at     timestamptz not null default now()  -- dùng cho delta sync (thay vì so chuỗi)
);
create index if not exists care_data_cs_idx         on care_data (cs);
create index if not exists care_data_updated_at_idx on care_data (updated_at);

-- 2) dt_tong  <=> sheet "DT TỔNG " (A:T, 20 cột; DT_COL_*). Khoá = id (cột T). Dòng chưa có id dùng src_row.
create table if not exists dt_tong (
  id              text,                       -- cột T (index 19)
  src_row         integer,                    -- số dòng gốc trên Sheet (để đối chiếu / dòng thiếu id)
  ngay_tao        text,                       -- cột A, chuỗi dd/MM/yyyy (_dtCellToVnStr_)
  ngay_tao_d      date,                       -- bản date để lọc khoảng ngày bằng index
  nguoi_tao       text,                       -- B
  giao_cho        text,                       -- C
  phone           text,                       -- D (normPhone_)
  giai_doan       text,                       -- G
  trang_thai      text,                       -- H
  thoi_gian_ht    text,                       -- K
  thoi_gian_ht_d  date,
  kenh_ban        text,                       -- M
  sale_ban        text,                       -- N
  san_pham        text,                       -- O
  phan_loai       text,                       -- P
  gia_tri_coc     numeric default 0,          -- Q
  gia_tri_don     numeric default 0,          -- R
  gia_tri_chenh   numeric default 0,          -- S
  raw             jsonb,                      -- cả 20 ô gốc, phòng cột chưa map
  archived        boolean not null default false,
  primary key (id, src_row)
);
create index if not exists dt_tong_phone_idx    on dt_tong (phone);
create index if not exists dt_tong_ngay_idx     on dt_tong (ngay_tao_d);
create index if not exists dt_tong_ht_idx       on dt_tong (thoi_gian_ht_d);
create index if not exists dt_tong_kenh_idx     on dt_tong (kenh_ban, sale_ban);

-- 3) don_chi_tiet <=> sheet "dữ liệu đơn" (DON_CHITIET_WIDTH cột; cột Q = ghi chú đơn / mã bộ đếm).
create table if not exists don_chi_tiet (
  src_row       integer primary key,
  ngay_tao_don  text,
  ngay_tao_d    date,                         -- đã kế thừa ngày dòng trên (giống readDonChiTiet_)
  phone         text,                         -- cột "Số điện thoại" (normPhone_)
  nguon_don     text,
  the_sale      text,
  san_pham      text,
  marketer      text,
  gia_tri_sau_giam numeric default 0,
  ghi_chu       text,                         -- cột Q (DON_COL_GHICHU)
  raw           jsonb,                        -- toàn bộ dòng gốc — bước 3 sẽ map đủ cột
  archived      boolean not null default false
);
create index if not exists don_phone_idx on don_chi_tiet (phone);
create index if not exists don_ngay_idx  on don_chi_tiet (ngay_tao_d);

-- 4) RLS: bật và KHÔNG tạo policy => anon key không đọc/ghi được gì.
--    GAS chỉ dùng service_role key (lưu trong Script Properties, KHÔNG commit vào repo, KHÔNG đưa vào extension/index.html).
alter table care_data    enable row level security;
alter table dt_tong      enable row level security;
alter table don_chi_tiet enable row level security;

-- 5) Chống Supabase free tự pause sau 7 ngày không hoạt động: GAS trigger hằng ngày gọi 1 select nhỏ (bước 2).

-- 6) fu_results — kết quả việc chăm sóc theo mốc (P2e, docs/ROADMAP-YEU-CAU.md). Khoá = id việc (vd dao_<sđt>_<ngày đơn>_<mốc>).
create table if not exists fu_results (
  id         text primary key,
  phone      text,
  due        date,                              -- ngày đến hạn của việc
  done_at    timestamptz not null default now(),
  result     text not null,                     -- contacted | nopick | refused | resched
  by_user    text default '',
  note       text default '',
  redo       date,                              -- ngày hẹn lại (khi result = resched)
  milestone  integer                            -- số ngày của mốc (0 = ngày mua, 30, 60...)
);
create index if not exists fu_results_due_idx  on fu_results (due);
create index if not exists fu_results_user_idx on fu_results (by_user);
alter table fu_results enable row level security;

-- 7) pk_webhook_raw — nhật ký THÔ webhook Pancake (docs/PANCAKE-INBOX.md, bước 1).
--    Cloudflare Worker (route /pancake-webhook) ghi NGUYÊN payload Pancake gửi tới, chưa tách tin nhắn.
--    Lý do ghi thô trước: tài liệu Pancake không mô tả định dạng webhook, nên phải nhìn mẫu thật rồi mới thiết kế
--    bảng hội thoại/tin nhắn (bước 2) — không đoán cấu trúc rồi mất dữ liệu vì sai cột.
--    page_id/event_type chỉ để lọc nhanh (lấy tạm từ vài chỗ thường gặp, có thể rỗng); sự thật nằm ở payload.
create table if not exists pk_webhook_raw (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  page_id     text default '',
  event_type  text default '',
  payload     jsonb not null
);
-- Bảng pk_webhook_raw từng bị tạo TAY bản thiếu cột (chỉ id/payload/created_at) nên `create table if not exists` ở mục 7 không bổ sung được
-- -> Worker ghi page_id/event_type bị Supabase từ chối (400) -> webhook trả 502 và MẤT TIN. Bổ sung cột ở đây (idempotent, không đụng dữ liệu cũ).
alter table pk_webhook_raw add column if not exists received_at timestamptz not null default now();
alter table pk_webhook_raw add column if not exists page_id     text default '';
alter table pk_webhook_raw add column if not exists event_type  text default '';
create index if not exists pk_webhook_raw_received_idx on pk_webhook_raw (received_at);
create index if not exists pk_webhook_raw_page_idx     on pk_webhook_raw (page_id, received_at);
alter table pk_webhook_raw enable row level security;

-- 8) pk_conversations / pk_messages — tách tin nhắn từ pk_webhook_raw (docs/PANCAKE-INBOX.md, bước 2).
--    Giữ cột `raw` (JSON gốc) để nếu cách tách sai thì tách lại được, không mất dữ liệu.
--    NGUYÊN NHÂN GỐC thiết kế "trigger nuốt lỗi": ghi webhook thô là việc QUAN TRỌNG NHẤT (mất tin = mất vĩnh viễn);
--    tách tin là việc phụ, sai cấu trúc payload không được làm hỏng việc ghi thô -> lỗi tách chỉ ghi vào process_error.
--    CHƯA RÕ định dạng thật của Pancake (tài liệu không mô tả): hiện tách theo dạng Messenger entry[].messaging[]
--    (sender/recipient/message.mid/text/timestamp). Payload khác dạng -> processed_at rỗng, xem process_error/raw rồi mở rộng hàm.
alter table pk_webhook_raw add column if not exists processed_at  timestamptz;
alter table pk_webhook_raw add column if not exists process_error text default '';

create table if not exists pk_conversations (
  id               text primary key,          -- tạm = <page_id>_<id khách>; đổi sang id hội thoại Pancake khi có mẫu thật
  page_id          text default '',
  raw              jsonb,
  updated_at       timestamptz default now()
);
alter table pk_conversations add column if not exists customer_id      text default '';
alter table pk_conversations add column if not exists customer_name    text default '';
alter table pk_conversations add column if not exists customer_phone   text default '';  -- sẽ điền ở bước gắn khách theo SĐT (normPhone_)
alter table pk_conversations add column if not exists last_message_at  timestamptz;
alter table pk_conversations add column if not exists last_text        text default '';
create index if not exists pk_conversations_page_idx on pk_conversations (page_id, last_message_at desc);
create index if not exists pk_conversations_phone_idx on pk_conversations (customer_phone);

create table if not exists pk_messages (
  id              text primary key,           -- message.mid của Pancake/Facebook (khoá chống trùng)
  conversation_id text references pk_conversations(id) on delete cascade,
  raw             jsonb,
  inserted_at     timestamptz default now()
);
alter table pk_messages add column if not exists page_id     text default '';
alter table pk_messages add column if not exists sender_id   text default '';
alter table pk_messages add column if not exists sender_name text default '';
alter table pk_messages add column if not exists direction   text default '';   -- 'in' = khách nhắn, 'out' = page/sale trả lời
alter table pk_messages add column if not exists text        text default '';
alter table pk_messages add column if not exists sent_at     timestamptz;
alter table pk_messages add column if not exists staff_name  text default '';   -- tên nhân viên Pancake gửi tin 'out' (lấy từ conversation.last_sent_by LÚC WEBHOOK NHẬN TIN — lúc đó đúng là người vừa gửi)
alter table pk_messages add column if not exists crm_user    text default '';    -- tên nhân viên CRM đã gửi tin này từ CRM (Pancake chỉ biết token page); webhook vọng lại KHÔNG ghi đè cột này
create index if not exists pk_messages_conv_idx on pk_messages (conversation_id, sent_at);

alter table pk_conversations enable row level security;
alter table pk_messages      enable row level security;
-- Gỡ policy "using (true)" từng tạo tay: nó cho mọi người có anon key đọc/ghi hết tin nhắn + SĐT khách.
drop policy if exists "Enable all access for pk_webhook_raw"   on pk_webhook_raw;
drop policy if exists "Enable all access for pk_conversations" on pk_conversations;
drop policy if exists "Enable all access for pk_messages"      on pk_messages;

create or replace function pk_ingest_raw(p_id bigint) returns int language plpgsql as $$
declare
  r pk_webhook_raw; ent jsonb; ev jsonb;
  v_page text; v_mid text; v_sender text; v_recip text; v_echo boolean; v_dir text;
  v_cust text; v_name text; v_conv text; v_text text; v_ms text; v_ts timestamptz;
  v_n int := 0; v_rc int;
begin
  select * into r from pk_webhook_raw where id = p_id;
  if not found then return 0; end if;
  -- Dạng THẬT của Pancake (đã xác nhận bằng payload 2026-10-12): {data:{message,conversation,post}, page_id, event_type, timestamp}
  if jsonb_typeof(r.payload) = 'object' and r.payload ? 'data' then return pk_ingest_pancake(r); end if;
  for ent in select e from jsonb_array_elements(case when jsonb_typeof(r.payload->'entry') = 'array' then r.payload->'entry' else '[]'::jsonb end) e loop
    for ev in select m from jsonb_array_elements(case when jsonb_typeof(ent->'messaging') = 'array' then ent->'messaging' else '[]'::jsonb end) m loop
      v_mid := ev #>> '{message,mid}';
      if v_mid is null or v_mid = '' then continue; end if;      -- sự kiện không phải tin nhắn (đã đọc, postback...) -> bỏ qua
      v_page   := coalesce(nullif(r.payload->>'page_id',''), nullif(ent->>'id',''), nullif(r.page_id,''), '');
      v_sender := coalesce(ev #>> '{sender,id}', '');
      v_recip  := coalesce(ev #>> '{recipient,id}', '');
      v_echo   := (ev #>> '{message,is_echo}') = 'true' or (v_sender <> '' and v_sender = v_page);
      v_dir    := case when v_echo then 'out' else 'in' end;
      v_cust   := case when v_echo then v_recip else v_sender end;
      v_name   := coalesce(case when v_echo then ev #>> '{recipient,name}' else ev #>> '{sender,name}' end, '');
      if v_cust = '' then continue; end if;
      v_conv   := v_page || '_' || v_cust;
      v_text   := coalesce(ev #>> '{message,text}', '');
      v_ms     := coalesce(ev->>'timestamp', ent->>'time', '');
      v_ts     := case when v_ms ~ '^[0-9]{10,13}$' then to_timestamp(v_ms::numeric / case when length(v_ms) >= 13 then 1000.0 else 1.0 end) else r.received_at end;
      insert into pk_conversations (id, page_id, customer_id, customer_name, last_message_at, last_text, raw, updated_at)
        values (v_conv, v_page, v_cust, v_name, v_ts, v_text, ev, now())
        on conflict (id) do update set
          customer_name   = coalesce(nullif(excluded.customer_name,''), pk_conversations.customer_name),
          last_text       = case when pk_conversations.last_message_at is null or excluded.last_message_at >= pk_conversations.last_message_at then excluded.last_text else pk_conversations.last_text end,
          last_message_at = greatest(pk_conversations.last_message_at, excluded.last_message_at),
          updated_at      = now();
      insert into pk_messages (id, conversation_id, page_id, sender_id, sender_name, direction, text, sent_at, raw)
        values (v_mid, v_conv, v_page, v_sender, coalesce(ev #>> '{sender,name}',''), v_dir, v_text, v_ts, ev)
        on conflict (id) do nothing;
      get diagnostics v_rc = row_count;
      v_n := v_n + v_rc;
    end loop;
  end loop;
  return v_n;
end $$;

create or replace function pk_webhook_raw_after_insert() returns trigger language plpgsql as $$
begin
  begin
    perform pk_ingest_raw(new.id);
    update pk_webhook_raw set processed_at = now(), process_error = '' where id = new.id;
  exception when others then
    update pk_webhook_raw set process_error = left(sqlerrm, 500) where id = new.id;
  end;
  return null;
end $$;
drop trigger if exists pk_webhook_raw_ingest on pk_webhook_raw;
create trigger pk_webhook_raw_ingest after insert on pk_webhook_raw for each row execute function pk_webhook_raw_after_insert();

-- Hàm chỉ để Worker/service_role dùng; không cho anon/authenticated gọi qua REST (rpc).
revoke all on function pk_ingest_raw(bigint) from public;
revoke all on function pk_webhook_raw_after_insert() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function pk_ingest_raw(bigint) from anon;
    revoke all on function pk_webhook_raw_after_insert() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function pk_ingest_raw(bigint) from authenticated;
    revoke all on function pk_webhook_raw_after_insert() from authenticated;
  end if;
end $$;

-- 9) Tách payload THẬT của Pancake (docs/PANCAKE-INBOX.md, bước 2b). Đã xác nhận bằng payload thật 2026-10-12:
--    {data:{message:{id,from:{id,name},message(HTML),original_message,conversation_id,inserted_at(UTC, không có múi giờ),phone_info[],attachments[]},
--           conversation:{id,from:{id,name},tags[],assignee_ids[uuid],customer_id(uuid Pancake),snippet,seen,is_replied,version}, post}, page_id, event_type, timestamp}
--    event_type: 'messaging' (có message + conversation), 'conversation' (đổi thẻ/người phụ trách/đã đọc), 'post' (bài đăng/bình luận: BỎ QUA ở bước này).
--    Hướng tin: from.id = page_id -> 'out' (page/sale trả lời HOẶC tin hệ thống như "X đã trả lời một quảng cáo"), còn lại 'in' (khách).
--    NGUYÊN NHÂN GỐC cần cột version: sự kiện 'messaging' kèm bản conversation CŨ (không có version, assignee khác), sự kiện 'conversation' mới hơn
--    mới là nguồn đúng cho thẻ/người phụ trách -> chỉ cho ghi đè khi version >= version đang có, tránh webhook đến sai thứ tự làm lùi dữ liệu.
alter table pk_conversations add column if not exists psid         text default '';
alter table pk_conversations add column if not exists snippet      text default '';
alter table pk_conversations add column if not exists tags         jsonb default '[]'::jsonb;
alter table pk_conversations add column if not exists assignee_ids text[] default '{}';
alter table pk_conversations add column if not exists seen         boolean default false;
alter table pk_conversations add column if not exists is_replied   boolean default false;
alter table pk_conversations add column if not exists conv_type    text default '';
alter table pk_conversations add column if not exists version      int;
create index if not exists pk_conversations_assignee_idx on pk_conversations using gin (assignee_ids);

-- Chuẩn hoá SĐT VN về dạng 0xxxxxxxxx (cùng dạng normPhone_ ở GAS); sai dạng -> chuỗi rỗng.
create or replace function pk_norm_phone(p text) returns text language sql immutable as $$
  select case
    when d ~ '^0[0-9]{9}$' then d
    when d ~ '^84[0-9]{9}$' then '0' || substr(d, 3)
    else '' end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

create or replace function pk_ingest_pancake(r pk_webhook_raw) returns int language plpgsql as $$
declare
  d jsonb := r.payload -> 'data';
  v_evt text := coalesce(nullif(r.payload->>'event_type', ''), r.event_type, '');
  v_page text := coalesce(nullif(r.payload->>'page_id', ''), nullif(r.page_id, ''), '');
  c jsonb; m jsonb;
  v_conv text; v_psid text; v_cname text; v_cid text; v_snip text; v_ver int;
  v_tags jsonb; v_ass text[]; v_seen boolean; v_rep boolean; v_type text;
  v_mid text; v_from text; v_dir text; v_staff text; v_text text; v_ins text; v_ts timestamptz; v_phone text; v_pi jsonb;
  v_n int := 0;
begin
  if d is null or jsonb_typeof(d) <> 'object' then return 0; end if;
  if v_evt not in ('messaging', 'conversation') then return 0; end if;   -- 'post' (bình luận/bài đăng) để bước sau
  c := case when jsonb_typeof(d->'conversation') = 'object' then d->'conversation' end;
  m := case when jsonb_typeof(d->'message') = 'object' then d->'message' end;
  v_conv := coalesce(nullif(c->>'id', ''), nullif(m->>'conversation_id', ''), '');
  if v_conv = '' then return 0; end if;
  if v_page = '' then v_page := coalesce(m->>'page_id', ''); end if;

  v_psid  := coalesce(c #>> '{from,id}', '');
  v_cname := coalesce(c #>> '{from,name}', '');
  v_cid   := coalesce(c->>'customer_id', '');
  v_snip  := coalesce(c->>'snippet', '');
  v_ver   := case when (c->>'version') ~ '^[0-9]+$' then (c->>'version')::int end;
  v_tags  := case when jsonb_typeof(c->'tags') = 'array' then c->'tags' else '[]'::jsonb end;
  v_ass   := case when jsonb_typeof(c->'assignee_ids') = 'array' then array(select jsonb_array_elements_text(c->'assignee_ids')) else '{}'::text[] end;
  v_seen  := coalesce((c->>'seen') = 'true', false);
  v_rep   := coalesce((c->>'is_replied') = 'true', false);
  v_type  := coalesce(c->>'type', '');

  v_mid := coalesce(m->>'id', '');
  if v_evt = 'messaging' and v_mid <> '' then
    v_from := coalesce(m #>> '{from,id}', '');
    v_dir  := case when v_from <> '' and v_from = v_page then 'out' else 'in' end;
    -- Tên nhân viên đã gửi tin 'out': last_sent_by của hội thoại ngay lúc này (Pancake trả kèm trong cùng webhook), hoặc admin_name nằm sẵn trong message.from.
    v_staff := case when v_dir = 'out' then coalesce(nullif(c #>> '{last_sent_by,admin_name}', ''), nullif(m #>> '{from,admin_name}', ''), nullif(c #>> '{last_sent_by,name}', ''), '') else '' end;
    v_text := coalesce(nullif(m->>'original_message', ''), regexp_replace(coalesce(m->>'message', ''), '<[^>]*>', '', 'g'), '');
    v_ins  := coalesce(m->>'inserted_at', '');
    v_ts   := case when v_ins ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then (v_ins::timestamp) at time zone 'UTC' else r.received_at end;   -- Pancake trả giờ UTC không kèm múi giờ
    if v_cname = '' and v_dir = 'in' then v_cname := coalesce(m #>> '{from,name}', ''); end if;
    -- SĐT khách: chỉ lấy từ tin KHÁCH nhắn (tránh nhầm SĐT của page/sale): phone_info (nếu có) rồi đến số gõ trong tin.
    v_phone := '';
    if v_dir = 'in' then
      v_pi := case when jsonb_typeof(m->'phone_info') = 'array' then m->'phone_info' else '[]'::jsonb end;
      select coalesce(max(pk_norm_phone(case when jsonb_typeof(e) = 'string' then e #>> '{}' else coalesce(e->>'phone_number', e->>'phone', e->>'captured', '') end)), '')
        into v_phone from jsonb_array_elements(v_pi) e;
      if v_phone = '' then
        v_phone := pk_norm_phone(substring(regexp_replace(v_text, '[ .\-]', '', 'g') from '(?:^|[^0-9])((?:\+?84|0)[35789][0-9]{8})(?:$|[^0-9])'));
      end if;
    end if;
  end if;

  insert into pk_conversations (id, page_id, psid, customer_id, customer_name, customer_phone, snippet, tags, assignee_ids, seen, is_replied, conv_type, version,
                                last_message_at, last_text, raw, updated_at)
    values (v_conv, v_page, v_psid, v_cid, v_cname, coalesce(v_phone, ''), v_snip, v_tags, v_ass, v_seen, v_rep, v_type, v_ver,
            v_ts, case when v_mid <> '' then coalesce(v_text, '') else '' end, d, now())
    on conflict (id) do update set
      page_id        = coalesce(nullif(excluded.page_id, ''), pk_conversations.page_id),
      psid           = coalesce(nullif(excluded.psid, ''), pk_conversations.psid),
      customer_id    = coalesce(nullif(excluded.customer_id, ''), pk_conversations.customer_id),
      customer_name  = coalesce(nullif(excluded.customer_name, ''), pk_conversations.customer_name),
      customer_phone = coalesce(nullif(pk_conversations.customer_phone, ''), nullif(excluded.customer_phone, ''), ''),
      snippet        = coalesce(nullif(excluded.snippet, ''), pk_conversations.snippet),
      conv_type      = coalesce(nullif(excluded.conv_type, ''), pk_conversations.conv_type),
      tags           = case when v_evt = 'conversation' and coalesce(excluded.version, 0) >= coalesce(pk_conversations.version, 0) then excluded.tags else pk_conversations.tags end,
      assignee_ids   = case when v_evt = 'conversation' and coalesce(excluded.version, 0) >= coalesce(pk_conversations.version, 0) then excluded.assignee_ids else pk_conversations.assignee_ids end,
      seen           = case when v_evt = 'conversation' and coalesce(excluded.version, 0) >= coalesce(pk_conversations.version, 0) then excluded.seen else pk_conversations.seen end,
      is_replied     = case when v_evt = 'conversation' and coalesce(excluded.version, 0) >= coalesce(pk_conversations.version, 0) then excluded.is_replied else pk_conversations.is_replied end,
      version        = greatest(excluded.version, pk_conversations.version),
      last_text      = case when excluded.last_message_at is not null and (pk_conversations.last_message_at is null or excluded.last_message_at >= pk_conversations.last_message_at) then excluded.last_text else pk_conversations.last_text end,
      last_message_at = greatest(pk_conversations.last_message_at, excluded.last_message_at),
      updated_at     = now();
  v_n := 1;

  if v_evt = 'messaging' and v_mid <> '' then
    insert into pk_messages (id, conversation_id, page_id, sender_id, sender_name, staff_name, direction, text, sent_at, raw)
      values (v_mid, v_conv, v_page, v_from, coalesce(m #>> '{from,name}', ''), v_staff, v_dir, v_text, v_ts, m)
      on conflict (id) do update set text = excluded.text, raw = excluded.raw,
        staff_name = coalesce(nullif(excluded.staff_name, ''), pk_messages.staff_name);   -- không xoá tên đã biết khi webhook gửi lại không kèm tên   -- Pancake gửi lại khi tin sửa/xoá: cập nhật, không nhân đôi
    v_n := v_n + 1;
  end if;
  return v_n;
end $$;

-- Tách lại các dòng thô đã có (vd sau khi sửa hàm tách). An toàn chạy lại nhiều lần: select pk_reprocess_raw();
create or replace function pk_reprocess_raw(p_from bigint default 0) returns int language plpgsql as $$
declare x record; n int := 0;
begin
  for x in select id from pk_webhook_raw where id >= p_from order by id loop
    begin
      perform pk_ingest_raw(x.id);
      update pk_webhook_raw set processed_at = now(), process_error = '' where id = x.id;
      n := n + 1;
    exception when others then
      update pk_webhook_raw set process_error = left(sqlerrm, 500) where id = x.id;
    end;
  end loop;
  return n;
end $$;

revoke all on function pk_ingest_pancake(pk_webhook_raw) from public;
revoke all on function pk_reprocess_raw(bigint) from public;
revoke all on function pk_norm_phone(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function pk_ingest_pancake(pk_webhook_raw) from anon;
    revoke all on function pk_reprocess_raw(bigint) from anon;
    revoke all on function pk_norm_phone(text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function pk_ingest_pancake(pk_webhook_raw) from authenticated;
    revoke all on function pk_reprocess_raw(bigint) from authenticated;
    revoke all on function pk_norm_phone(text) from authenticated;
  end if;
end $$;

-- 10) pk_staff — nhân viên Pancake (id uuid trong pk_conversations.assignee_ids -> tên). Do GAS pkNhanVienDongBo ghi (service_role).
--     NGUYÊN NHÂN GỐC: webhook/API chỉ trả mã nhân viên (uuid), không kèm tên nên khung chat không hiện được "sale nào phụ trách".
--     Khung chat vẫn chạy bình thường khi bảng này trống/chưa tạo (GAS bắt lỗi, trả danh sách tên rỗng).
create table if not exists pk_staff (
  id         text primary key,
  name       text default '',
  page_id    text default '',
  raw        jsonb,
  updated_at timestamptz default now()
);
alter table pk_staff enable row level security;   -- bật RLS, KHÔNG policy: chỉ service_role đọc/ghi (có tên + dữ liệu nhân viên)

-- 11) pk_tags — danh mục THẺ Pancake (tags trong hội thoại chỉ là MÃ SỐ, vd [109]) để Worker đọc thẳng Supabase đổi mã -> tên/màu.
--     Do GAS pkDanhMucDongBo ghi (GET /pages/{page}/tags). NGUYÊN NHÂN GỐC: Worker không giữ token Pancake, và không nên gọi API Pancake mỗi lần poll
--     -> đồng bộ vài giờ/lần vào bảng này. RLS bật, KHÔNG policy: chỉ service_role đọc/ghi.
create table if not exists pk_tags (
  id         text primary key,            -- '<page_id>:<tag_id>'
  page_id    text not null default '',
  tag_id     text not null default '',
  text       text default '',
  color      text default '',
  raw        jsonb,
  updated_at timestamptz default now()
);
create index if not exists pk_tags_page_idx on pk_tags (page_id);
alter table pk_tags enable row level security;

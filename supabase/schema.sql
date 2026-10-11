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
create index if not exists pk_messages_conv_idx on pk_messages (conversation_id, sent_at);

alter table pk_conversations enable row level security;
alter table pk_messages      enable row level security;
-- Gỡ policy "using (true)" từng tạo tay: nó cho mọi người có anon key đọc/ghi hết tin nhắn + SĐT khách.
drop policy if exists "Enable all access for pk_webhook_raw"   on pk_webhook_raw;
drop policy if exists "Enable all access for pk_conversations" on pk_conversations;
drop policy if exists "Enable all access for pk_messages"      on pk_messages;

create or replace function pk_ingest_raw(p_id bigint) returns int language plpgsql as $$
declare
  r record; ent jsonb; ev jsonb;
  v_page text; v_mid text; v_sender text; v_recip text; v_echo boolean; v_dir text;
  v_cust text; v_name text; v_conv text; v_text text; v_ms text; v_ts timestamptz;
  v_n int := 0; v_rc int;
begin
  select * into r from pk_webhook_raw where id = p_id;
  if not found then return 0; end if;
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

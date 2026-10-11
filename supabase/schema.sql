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

-- 7) KHO / TỒN KHO (CRM thay Pos làm nơi cập nhật tồn thật). Admin tạo kho; leader + thành viên (username) sửa tồn; mọi người xem.
--    Mọi thay đổi số lượng đi qua 3 hàm dưới (nguyên tử + ghi nhật ký cùng giao dịch):
--    ton_kho_set (sửa tay, kiểm phiên bản → báo xung đột thay vì ghi đè), ton_kho_adjust (cộng/trừ, dùng khi có đơn; chống trừ 2 lần theo ref),
--    ton_kho_import (nhập hàng loạt từ file Excel Pos). GAS gọi bằng service key qua /rest/v1/rpc/<tên>.
create table if not exists kho (
  id         text primary key,
  ten        text not null,
  leader     text not null default '',                 -- username
  members    jsonb not null default '[]',              -- mảng username
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists ton_kho (
  kho_id     text not null references kho(id) on delete cascade,
  ma_hang    text not null,
  ten_hang   text not null default '',
  ton        numeric not null default 0,
  nguong     numeric not null default 0,               -- cảnh báo sắp hết khi ton <= nguong và nguong > 0
  ver        integer not null default 1,               -- tăng mỗi lần đổi; sửa tay phải gửi đúng ver đã thấy
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  primary key (kho_id, ma_hang)
);
create table if not exists ton_kho_log (
  id      bigserial primary key,
  kho_id  text not null,
  ma_hang text not null,
  truoc   numeric not null default 0,
  sau     numeric not null default 0,
  loai    text not null default 'sua',                 -- sua | nhap | don | hoan | tao
  ly_do   text not null default '',
  ref     text not null default '',                    -- mã đơn (chống trừ tồn 2 lần cho cùng đơn + mã hàng + loại)
  by_user text not null default '',
  at      timestamptz not null default now()
);
create index if not exists ton_kho_log_kho_idx on ton_kho_log (kho_id, at desc);
create index if not exists ton_kho_log_ma_idx  on ton_kho_log (kho_id, ma_hang, at desc);
create index if not exists ton_kho_log_ref_idx on ton_kho_log (ref) where ref <> '';
alter table kho          enable row level security;
alter table ton_kho      enable row level security;
alter table ton_kho_log  enable row level security;

create or replace function ton_kho_set(p_kho text, p_ma text, p_ten text, p_ton numeric, p_ver integer,
                                       p_by text, p_ly_do text default '', p_loai text default 'sua')
returns jsonb language plpgsql as $$
declare cur ton_kho%rowtype; old_ton numeric; ma text := btrim(coalesce(p_ma, ''));
begin
  if ma = '' then return jsonb_build_object('ok', false, 'error', 'Thieu ma hang'); end if;
  if p_ton is null then return jsonb_build_object('ok', false, 'error', 'Thieu so luong'); end if;
  if not exists (select 1 from kho where id = p_kho and active) then
    return jsonb_build_object('ok', false, 'error', 'Kho khong ton tai hoac da tat');
  end if;
  select * into cur from ton_kho where kho_id = p_kho and ma_hang = ma for update;
  if not found then
    if coalesce(p_ver, 0) <> 0 then
      return jsonb_build_object('ok', false, 'conflict', true, 'error', 'Dong nay khong con ton tai');
    end if;
    insert into ton_kho(kho_id, ma_hang, ten_hang, ton, updated_by)
      values (p_kho, ma, btrim(coalesce(p_ten, '')), p_ton, coalesce(p_by, ''))
      on conflict (kho_id, ma_hang) do nothing returning * into cur;
    if not found then return jsonb_build_object('ok', false, 'conflict', true, 'error', 'Co nguoi vua tao dong nay'); end if;
    insert into ton_kho_log(kho_id, ma_hang, truoc, sau, loai, ly_do, by_user) values (p_kho, ma, 0, p_ton, 'tao', coalesce(p_ly_do, ''), coalesce(p_by, ''));
    return jsonb_build_object('ok', true, 'row', to_jsonb(cur));
  end if;
  if p_ver is distinct from cur.ver then
    return jsonb_build_object('ok', false, 'conflict', true, 'error', 'Co nguoi vua sua dong nay', 'row', to_jsonb(cur));
  end if;
  old_ton := cur.ton;
  update ton_kho set ton = p_ton, ten_hang = coalesce(nullif(btrim(coalesce(p_ten, '')), ''), ten_hang),
         ver = ver + 1, updated_by = coalesce(p_by, ''), updated_at = now()
   where kho_id = p_kho and ma_hang = ma returning * into cur;
  insert into ton_kho_log(kho_id, ma_hang, truoc, sau, loai, ly_do, by_user) values (p_kho, ma, old_ton, p_ton, coalesce(nullif(p_loai, ''), 'sua'), coalesce(p_ly_do, ''), coalesce(p_by, ''));
  return jsonb_build_object('ok', true, 'row', to_jsonb(cur));
end $$;

create or replace function ton_kho_adjust(p_kho text, p_ma text, p_delta numeric, p_by text, p_loai text default 'don',
                                          p_ref text default '', p_ly_do text default '', p_allow_negative boolean default true)
returns jsonb language plpgsql as $$
declare cur ton_kho%rowtype; old_ton numeric; ma text := btrim(coalesce(p_ma, '')); rf text := coalesce(p_ref, '');
begin
  if ma = '' or p_delta is null then return jsonb_build_object('ok', false, 'error', 'Thieu ma hang hoac so luong'); end if;
  if not exists (select 1 from kho where id = p_kho and active) then
    return jsonb_build_object('ok', false, 'error', 'Kho khong ton tai hoac da tat');
  end if;
  if rf <> '' and exists (select 1 from ton_kho_log where kho_id = p_kho and ma_hang = ma and loai = p_loai and ref = rf) then
    select * into cur from ton_kho where kho_id = p_kho and ma_hang = ma;
    return jsonb_build_object('ok', true, 'duplicate', true, 'row', to_jsonb(cur));
  end if;
  select ton into old_ton from ton_kho where kho_id = p_kho and ma_hang = ma for update;
  if not p_allow_negative and coalesce(old_ton, 0) + p_delta < 0 then
    return jsonb_build_object('ok', false, 'insufficient', true, 'error', 'Khong du ton', 'ton', coalesce(old_ton, 0));
  end if;
  insert into ton_kho(kho_id, ma_hang, ton, updated_by) values (p_kho, ma, p_delta, coalesce(p_by, ''))
    on conflict (kho_id, ma_hang) do update
      set ton = ton_kho.ton + p_delta, ver = ton_kho.ver + 1, updated_by = coalesce(p_by, ''), updated_at = now()
    returning * into cur;
  insert into ton_kho_log(kho_id, ma_hang, truoc, sau, loai, ly_do, ref, by_user)
    values (p_kho, ma, coalesce(old_ton, 0), cur.ton, coalesce(nullif(p_loai, ''), 'don'), coalesce(p_ly_do, ''), rf, coalesce(p_by, ''));
  return jsonb_build_object('ok', true, 'row', to_jsonb(cur));
end $$;

create or replace function ton_kho_import(p_kho text, p_rows jsonb, p_by text, p_ly_do text default '')
returns jsonb language plpgsql as $$
declare r jsonb; ma text; v_ten text; v_ton numeric; old_ton numeric; cur ton_kho%rowtype;
        n_new integer := 0; n_upd integer := 0; n_skip integer := 0;
begin
  if not exists (select 1 from kho where id = p_kho and active) then
    return jsonb_build_object('ok', false, 'error', 'Kho khong ton tai hoac da tat');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then return jsonb_build_object('ok', false, 'error', 'rows phai la mang'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    ma := btrim(coalesce(r->>'ma', ''));
    v_ten := btrim(coalesce(r->>'ten', ''));
    begin v_ton := (r->>'ton')::numeric; exception when others then v_ton := null; end;
    if ma = '' or v_ton is null then n_skip := n_skip + 1; continue; end if;
    select ton into old_ton from ton_kho where kho_id = p_kho and ma_hang = ma for update;
    insert into ton_kho(kho_id, ma_hang, ten_hang, ton, updated_by) values (p_kho, ma, v_ten, v_ton, coalesce(p_by, ''))
      on conflict (kho_id, ma_hang) do update
        set ton = excluded.ton, ten_hang = coalesce(nullif(excluded.ten_hang, ''), ton_kho.ten_hang),
            ver = ton_kho.ver + 1, updated_by = coalesce(p_by, ''), updated_at = now()
      returning * into cur;
    insert into ton_kho_log(kho_id, ma_hang, truoc, sau, loai, ly_do, by_user)
      values (p_kho, ma, coalesce(old_ton, 0), v_ton, 'nhap', coalesce(p_ly_do, ''), coalesce(p_by, ''));
    if old_ton is null then n_new := n_new + 1; else n_upd := n_upd + 1; end if;
    old_ton := null;
  end loop;
  return jsonb_build_object('ok', true, 'created', n_new, 'updated', n_upd, 'skipped', n_skip);
end $$;

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

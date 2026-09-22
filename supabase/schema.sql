-- =====================================================================
-- スクール生お店マップ  Supabase スキーマ
-- Supabase ダッシュボード → SQL Editor にこのファイルを丸ごと貼って Run
-- 既存の共有プロジェクトに同居させるため、すべて shopmap_ 接頭辞で分離
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 1. お店テーブル ----------
create table if not exists public.shopmap_shops (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  name          text not null check (char_length(name) between 1 and 80),
  category      text not null
                check (category in ('food','farm','salon','shop','stay','school','other')),
  photo_url     text,
  hours         text,
  address       text not null,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  message       text,              -- スクール生へのメッセージ／特典
  website       text,
  instagram     text,
  owner_name    text,              -- 運営者（スクール生）のお名前：地図に表示
  contact_email text,              -- 管理者への連絡用：地図には出さない
  approved_at   timestamptz
);

create index if not exists shopmap_shops_status_idx on public.shopmap_shops (status);

-- ---------- 2. 管理者リスト（ここに入れたメールだけが管理画面を使える） ----------
create table if not exists public.shopmap_admins (
  email text primary key
);

-- ---------- 3. 設定（閲覧用共通パスワードのハッシュ） ----------
create table if not exists public.shopmap_settings (
  key   text primary key,
  value text not null
);

-- ---------- 4. RLS（行レベルセキュリティ） ----------
alter table public.shopmap_shops    enable row level security;
alter table public.shopmap_admins   enable row level security;
alter table public.shopmap_settings enable row level security;
-- shopmap_settings / shopmap_admins にはポリシーを作らない＝APIからは誰も読めない

create or replace function public.shopmap_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shopmap_admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 誰でも「承認待ち」としてだけ投稿できる（承認済みで直接入れることは不可）
drop policy if exists shopmap_submit on public.shopmap_shops;
create policy shopmap_submit on public.shopmap_shops
  for insert to anon, authenticated
  with check (status = 'pending' and approved_at is null);

-- 管理者は全件の閲覧・承認・編集・削除ができる
drop policy if exists shopmap_admin_all on public.shopmap_shops;
create policy shopmap_admin_all on public.shopmap_shops
  for all to authenticated
  using (public.shopmap_is_admin())
  with check (public.shopmap_is_admin());

-- ※ 一般閲覧用の select ポリシーはあえて作らない。
--    地図のデータは下の関数（共通パスワード必須）経由でしか取れない。

-- ---------- 5. 閲覧用関数：パスワードが合っていれば承認済みのお店だけ返す ----------
create or replace function public.shopmap_get_shops(p_password text)
returns table (
  id uuid, name text, category text, photo_url text, hours text,
  address text, lat double precision, lng double precision,
  message text, website text, instagram text, owner_name text
)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select value into v_hash from public.shopmap_settings where key = 'view_password_hash';
  if v_hash is null or p_password is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'invalid_password' using errcode = '28P01';
  end if;

  return query
    select s.id, s.name, s.category, s.photo_url, s.hours,
           s.address, s.lat, s.lng,
           s.message, s.website, s.instagram, s.owner_name
    from public.shopmap_shops s
    where s.status = 'approved'
    order by s.approved_at desc nulls last;
end;
$$;

revoke all on function public.shopmap_get_shops(text) from public;
grant execute on function public.shopmap_get_shops(text) to anon, authenticated;

-- ---------- 6. 写真の保存場所（Storage） ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shopmap-photos', 'shopmap-photos', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists shopmap_photo_upload on storage.objects;
create policy shopmap_photo_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'shopmap-photos');

drop policy if exists shopmap_photo_admin_delete on storage.objects;
create policy shopmap_photo_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'shopmap-photos' and public.shopmap_is_admin());

-- =====================================================================
-- 初期設定（下の2行は値を書き換えてから Run。何度実行しても上書きされるだけ）
-- =====================================================================
-- 閲覧用の共通パスワード（公開リポジトリに実物を書かないこと。SQL Editorで実行する時だけ書き換える）
insert into public.shopmap_settings (key, value)
values ('view_password_hash', extensions.crypt('ここに閲覧パスワード', extensions.gen_salt('bf')))
on conflict (key) do update set value = excluded.value;

-- 管理者のメールアドレス（Authentication → Users で同じメールのユーザーを作成しておく）
insert into public.shopmap_admins (email)
values ('organiclifeingermany@gmail.com')
on conflict do nothing;

-- =====================================================================
-- 追加（2026-09-21）：お店にいるスクール生（名前・役割・受講講座・認定資格・顔写真）
-- people = [{ name, role, courses: [], certs: [], note, photo_url }]
-- 閲覧関数 shopmap_get_shops は people も返すように作り直した（戻り値が変わるため drop → create）
-- =====================================================================
alter table public.shopmap_shops add column if not exists people jsonb not null default '[]'::jsonb;
alter table public.shopmap_shops drop constraint if exists shopmap_people_is_array;
alter table public.shopmap_shops add constraint shopmap_people_is_array check (jsonb_typeof(people) = 'array');
-- shopmap_get_shops の returns table 末尾に people jsonb を追加し、select にも s.people を追加して再作成すること

-- =====================================================================
-- 追加（2026-09-22）：①スクール生の追加申請（既存のお店に「私もここにいます」）
--                    ②実店舗なし（オンライン・商品）カテゴリ＝住所・位置なしで登録可
-- =====================================================================
create table if not exists public.shopmap_member_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  shop_id       uuid not null references public.shopmap_shops(id) on delete cascade,
  person        jsonb not null check (jsonb_typeof(person) = 'object' and coalesce(person->>'name', '') <> ''),
  contact_email text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);
alter table public.shopmap_member_requests enable row level security;
drop policy if exists shopmap_member_submit on public.shopmap_member_requests;
create policy shopmap_member_submit on public.shopmap_member_requests for insert to anon, authenticated
  with check (status = 'pending');
drop policy if exists shopmap_member_admin_all on public.shopmap_member_requests;
create policy shopmap_member_admin_all on public.shopmap_member_requests for all to authenticated
  using (public.shopmap_is_admin()) with check (public.shopmap_is_admin());

alter table public.shopmap_shops drop constraint if exists shopmap_shops_category_check;
alter table public.shopmap_shops add constraint shopmap_shops_category_check
  check (category in ('food','farm','salon','shop','stay','school','online','other'));
alter table public.shopmap_shops alter column lat drop not null;
alter table public.shopmap_shops alter column lng drop not null;
alter table public.shopmap_shops alter column address drop not null;
alter table public.shopmap_shops drop constraint if exists shopmap_location_required;
alter table public.shopmap_shops add constraint shopmap_location_required
  check (category = 'online' or (lat is not null and lng is not null and coalesce(address, '') <> ''));

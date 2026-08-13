export const SUPABASE_SETUP_SQL = `-- ====================================================================
-- YUMMY EXPRESS - SUPABASE DATABASE SETUP SQL
-- ====================================================================
-- কীভাবে ব্যবহার করবেন:
-- ১. Supabase Dashboard (https://supabase.com) থেকে আপনার প্রজেক্ট খুলুন।
-- ২. বামদিকের মেনু থেকে "SQL Editor" এ ক্লিক করুন।
-- ৩. "+ New Query" এ ক্লিক করে একটি খালি উইন্ডো খুলুন।
-- ৪. নিচের কোডগুলো পেস্ট করে "Run" বাটনে ক্লিক করুন।
-- ====================================================================

-- ১. পুরনো টেবিলগুলো মুছে ফেলা
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.settings cascade;
drop table if exists public.admins cascade;
drop table if exists public.users cascade;
drop table if exists public.visitor_logs cascade;

-- ২. EXTENSIONS এনাবল করা
create extension if not exists "uuid-ossp";

-- ৩. USERS টেবিল
create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    photo_url text,
    phone text,
    address text,
    city text,
    area text,
    bio text,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৪. ADMINS টেবিল
create table public.admins (
    id text primary key,
    email text unique not null,
    role text default 'full',
    permissions text default 'products,orders,settings,customers',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৫. PRODUCTS টেবিল
create table public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    "nameBn" text not null,
    price numeric not null,
    discount numeric default 0,
    description text,
    "descriptionBn" text,
    image text,
    category text not null,
    "categoryBn" text not null,
    "isNew" boolean default false,
    "isOffer" boolean default false,
    stock integer default 100,
    weight text,
    "weightBn" text,
    "originalPrice" numeric,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৬. SETTINGS টেবিল
create table public.settings (
    id text primary key default 'global',
    "heroTitle" text,
    "heroDesc" text,
    "heroTitleBn" text,
    "heroDescBn" text,
    "logoUrl" text,
    "companyInfo" jsonb default '{"description": "", "descriptionBn": "", "mission": "", "missionBn": "", "team": []}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৭. ORDERS টেবিল
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    items jsonb not null,
    total numeric not null,
    customer jsonb not null,
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৮. VISITOR LOGS টেবিল
create table if not exists public.visitor_logs (
    id text primary key,
    ip text,
    userAgent text,
    deviceType text,
    browser text,
    os text,
    visitedAt text
);

-- ৯. ডিফল্ট গ্লোবাল সেটিংস এন্ট্রি
insert into public.settings (id, "heroTitle", "heroDesc", "heroTitleBn", "heroDescBn", "logoUrl", "companyInfo", updated_at)
values (
  'global',
  'Yummy Express',
  'Gourmet burgers, artisan pizza, healthy salads, and mouth-watering desserts delivered fresh to your door.',
  'ইয়ামি এক্সপ্রেস',
  'গুরমেট বার্গার, আর্টিসান পিজা, স্বাস্থ্যকর সালাদ এবং মুখের জল আনা ডেজার্ট সতেজ অবস্থায় আপনার দোরগোড়ায় পৌঁছে গেছে।',
  '',
  '{"description": "The best meal delivery service in town", "descriptionBn": "শহরের সেরা খাবার ডেলিভারি সার্ভিস", "mission": "To serve high quality, fresh food with love", "missionBn": "ভালোবাসা সহকারে উচ্চমানের এবং তাজা খাবার পরিবেশন করা", "team": []}'::jsonb,
  now()
) on conflict (id) do nothing;

-- ১০. প্রাথমিক সুপার অ্যাডমিন এন্ট্রি
insert into public.admins (id, email, created_at)
values ('careers-super-admin-uid-placeholder', 'careers.growthexpress@gmail.com', now())
on conflict (id) do nothing;

-- ১১. STORAGE BUCKETS (ছবি আপলোডের বাকেট)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- ১২. ROW LEVEL SECURITY (RLS) পলিসি
alter table public.users disable row level security;
alter table public.admins disable row level security;
alter table public.products disable row level security;
alter table public.settings disable row level security;
alter table public.orders disable row level security;
alter table public.visitor_logs disable row level security;

-- স্টোরেজ পলিসি
drop policy if exists "Allow public storage select access" on storage.objects;
create policy "Allow public storage select access" on storage.objects for select using ( bucket_id = 'images' );

drop policy if exists "Allow authenticated storage insert access" on storage.objects;
create policy "Allow authenticated storage insert access" on storage.objects for insert with check ( bucket_id = 'images' );

drop policy if exists "Allow authenticated storage update access" on storage.objects;
create policy "Allow authenticated storage update access" on storage.objects for update with check ( bucket_id = 'images' );
`;

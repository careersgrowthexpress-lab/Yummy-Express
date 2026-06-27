-- ====================================================================
-- YUMMY EXPRESS - COMPREHENSIVE SUPABASE SQL DATABASE SCHEMA
-- ====================================================================
-- কীভাবে ব্যবহার করবেন:
-- ১. Supabase Dashboard-এ যান (https://supabase.com).
-- ২. আপনার 'Yummy Express' প্রজেক্ট নির্বাচন করুন।
-- ৩. বামদিকের সাইডবার থেকে "SQL Editor" এ ক্লিক করুন।
-- ৪. "+ New Query" এ ক্লিক করে একটি খালি উইন্ডো খুলুন।
-- ৫. সম্পূর্ণ নিচের কোড কপি করে সেখানে পেস্ট করুন এবং "Run" বাটনে ক্লিক করুন।
-- ====================================================================

-- ১. পুরনো টেবিলগুলো মুছে ফেলা (যাতে কোনো কলাম বা রিলেশন ক্র্যাশ না ঘটে)
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.settings cascade;
drop table if exists public.admins cascade;
drop table if exists public.users cascade;

-- ২. EXTENSIONS এনাবল করা (যাতে UUID এবং অন্যান্য ফিচার সঠিক কাজ করে)
create extension if not exists "uuid-ossp";

-- ৩. USERS (কাস্টমার প্রোফাইল) টেবিল তৈরি করা
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

-- ৪. ADMINS (অ্যাডমিন অ্যাকাউন্টস) টেবিল তৈরি করা
create table public.admins (
    id text primary key, -- Auth User UID (Text format to support standard ID structures)
    email text unique not null,
    role text default 'full',
    permissions text default 'products,orders,settings,customers',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ৫. PRODUCTS (খাবার/প্রোডাক্টস) টেবিল তৈরি করা
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

-- ৬. SETTINGS (সাইট ও কোম্পানির পুরো সেটিংস) টেবিল তৈরি করা
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

-- ৭. ORDERS (অর্ডার হিস্টোরি) টেবিল তৈরি করা
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    items jsonb not null, -- CartItem[] structured array
    total numeric not null,
    customer jsonb not null, -- CustomerDetails structured object
    status text not null default 'pending', -- 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);


-- ====================================================================
-- অটোমেটেড ইউজার প্রোফাইল ক্রিয়েশন ট্রিগার (AUTOMATED PROFILE CREATION ON SIGN-UP)
-- ====================================================================
-- Supabase-এর Auth সেকশনে নতুন ইউজার রেজিস্ট্রেশন করলে স্বয়ংক্রিয়ভাবে public.users টেবিলে প্রোফাইল ডাটা সিঙ্ক করার জন্য এই ফাংশন এবং ট্রিগার ব্যবহত হয়।
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, photo_url, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ট্রিগার ড্রপ ও নতুন করে ক্রিয়েট করা
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ====================================================================
-- ডাটাবেজ ডেকোরেশন এবং প্রাথমিক বীজ ডাটা সিডিং (INITIAL SEED DATA)
-- ====================================================================

-- গ্লোবাল সেটিংস ডিফল্ট এন্ট্রি (Global Site Settings Preset)
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
)
on conflict (id) do update set
  "heroTitle" = excluded."heroTitle",
  "heroDesc" = excluded."heroDesc",
  "heroTitleBn" = excluded."heroTitleBn",
  "heroDescBn" = excluded."heroDescBn";

-- প্রাথমিক সুপারমিন এন্ট্রি (Super Admin Auto-add to prevent initial lockout)
insert into public.admins (id, email, created_at)
values (
  'careers-super-admin-uid-placeholder', 
  'careers.growthexpress@gmail.com',
  now()
)
on conflict (id) do nothing;


-- ====================================================================
-- STORAGE BUCKETS (ছবি আপলোডের জন্য স্টোরেজ বাকেট তৈরি)
-- ====================================================================
-- ছবিতে প্রোডাক্ট ও লোগো আপলোডের বাকেট 'images' তৈরি করার জন্য নিচের SQL রান করুন।
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) পলিসি কনফিগারেশন
-- ====================================================================
alter table public.users disable row level security;
alter table public.admins disable row level security;
alter table public.products disable row level security;
alter table public.settings disable row level security;
alter table public.orders disable row level security;

-- (ঐচ্ছিক/প্রোডাকশন ডেভেলপমেন্ট সিকিউরিটি): স্টোরেজ বাকেট অ্যাক্সেস পলিসি
drop policy if exists "Allow public storage select access" on storage.objects;
create policy "Allow public storage select access"
  on storage.objects for select using ( bucket_id = 'images' );

drop policy if exists "Allow authenticated storage insert access" on storage.objects;
create policy "Allow authenticated storage insert access"
  on storage.objects for insert with check ( bucket_id = 'images' );

drop policy if exists "Allow authenticated storage update access" on storage.objects;
create policy "Allow authenticated storage update access"
  on storage.objects for update with check ( bucket_id = 'images' );

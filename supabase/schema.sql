-- Active Fitness Gym (Cairo) - Supabase Database Schema
-- Run this script in your Supabase SQL Editor

-- 1. GYM STATUS TABLE (Real-time occupancy & open/closed banner)
CREATE TABLE IF NOT EXISTS public.gym_status (
  id BIGINT PRIMARY KEY DEFAULT 1,
  branch_name TEXT NOT NULL DEFAULT 'Active Fitness Gym — Cairo Flagship',
  is_open BOOLEAN NOT NULL DEFAULT true,
  operating_hours TEXT NOT NULL DEFAULT 'Open 24/7 • All Week',
  current_capacity INTEGER NOT NULL DEFAULT 42,
  max_capacity INTEGER NOT NULL DEFAULT 120,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default Cairo Flagship row if not present
INSERT INTO public.gym_status (id, branch_name, is_open, operating_hours, current_capacity, max_capacity)
VALUES (1, 'Active Fitness Gym — New Cairo Flagship', true, '24/7 Operating Hours', 46, 120)
ON CONFLICT (id) DO NOTHING;

-- 2. PROFILES / MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  membership_id TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Premium' CHECK (tier IN ('Standard', 'Premium', 'VIP')),
  renewal_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '180 days'),
  fingerprint_enrolled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. GUEST PASSES TABLE
CREATE TABLE IF NOT EXISTS public.guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  member_name TEXT,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  pass_code TEXT UNIQUE NOT NULL,
  tier_at_issue TEXT NOT NULL DEFAULT 'Standard',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Redeemed', 'Expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.gym_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;

-- Policies for gym_status (Readable by everyone, updatable for live capacity demo)
DROP POLICY IF EXISTS "Allow public read on gym_status" ON public.gym_status;
CREATE POLICY "Allow public read on gym_status"
  ON public.gym_status FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public update on gym_status" ON public.gym_status;
CREATE POLICY "Allow public update on gym_status"
  ON public.gym_status FOR UPDATE
  USING (true);

-- Policies for profiles
DROP POLICY IF EXISTS "Allow users to view own profile" ON public.profiles;
CREATE POLICY "Allow users to view own profile"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow users to upsert own profile" ON public.profiles;
CREATE POLICY "Allow users to upsert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile"
  ON public.profiles FOR UPDATE
  USING (true);

-- Policies for guest_passes
DROP POLICY IF EXISTS "Allow read guest_passes" ON public.guest_passes;
CREATE POLICY "Allow read guest_passes"
  ON public.guest_passes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert guest_passes" ON public.guest_passes;
CREATE POLICY "Allow insert guest_passes"
  ON public.guest_passes FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for gym_status and guest_passes
ALTER PUBLICATION supabase_realtime ADD TABLE public.gym_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_passes;

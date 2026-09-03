-- ====================================================================
-- SQL SEED SCRIPT - CREATE OWNER USER IN SUPABASE AUTH
-- ====================================================================
-- INSTRUCTIONS: Copy this entire script and run it in the SQL Editor
-- of your Supabase dashboard to seed your first owner account.
-- ====================================================================

-- 1. Ensure pgcrypto extension is enabled for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Insert the owner user into auth.users
-- This creates a user with email: admin@gmail.com and password: admin123456
-- Due to our database triggers, this user will automatically become 
-- the 'owner' inside public.profiles.
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@gmail.com',
  crypt('admin123456', gen_salt('bf', 10)), -- Hashes password 'admin123456' using bcrypt (Blowfish)
  now(),
  null,
  null,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Owner Admin"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- ====================================================================
-- SQL SEED SCRIPT - SEED OWNER PROFILE FOR admin@gmail.com
-- ====================================================================
-- INSTRUCTIONS: Run this entire script in the SQL Editor of your
-- Supabase project dashboard to seed the user and link their owner profile.
-- ====================================================================

-- 1. Ensure pgcrypto extension is active for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Insert the user into auth.users (if not already existing)
-- Sets email: admin@gmail.com and password: admin123456
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
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@gmail.com',
  crypt('admin123456', gen_salt('bf', 10)), -- Hashes password 'admin123456'
  now(), -- Pre-confirms email so no verification is required
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
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com'
);

-- 3. Link the user to public.profiles and set their role to 'owner'
-- This creates or updates the profile corresponding to the auth account.
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Owner Admin', 'owner'::public.user_role
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'owner'::public.user_role,
    email = EXCLUDED.email;

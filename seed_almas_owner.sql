-- ====================================================================
-- SQL SEED SCRIPT - SEED OWNER ACCOUNT (almas@admin.com)
-- ====================================================================
-- Instructions: Run this entire script in your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Run)
-- ====================================================================

-- 1. Ensure pgcrypto extension is active for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Insert or update the user in auth.users
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'almas@admin.com';

  IF v_user_id IS NULL THEN
    -- Insert new user
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
      'almas@admin.com',
      crypt('almas12345', gen_salt('bf', 10)),
      now(),
      null,
      null,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Almas Admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;
  ELSE
    -- Update existing user password and confirm email
    UPDATE auth.users
    SET encrypted_password = crypt('almas12345', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = '{"full_name":"Almas Admin"}'::jsonb,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 3. Ensure profile in public.profiles exists and has 'owner' role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, 'almas@admin.com', 'Almas Admin', 'owner'::public.user_role)
  ON CONFLICT (id) DO UPDATE
  SET role = 'owner'::public.user_role,
      email = EXCLUDED.email,
      full_name = 'Almas Admin';

END $$;

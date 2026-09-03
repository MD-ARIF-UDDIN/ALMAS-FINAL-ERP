-- ====================================================================
-- MIGRATION: CREATE COLORS / SHADE CARD TABLE & PRODUCT COLOR FIELDS
-- ====================================================================
-- Run this script in your Supabase SQL Editor to enable color/shade management.

-- 1. Create Colors Table
CREATE TABLE IF NOT EXISTS public.colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    shade_card VARCHAR(100) DEFAULT 'Almas Standard',
    hex_code VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(code, shade_card)
);

-- 2. Add color fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_code VARCHAR(50);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_name VARCHAR(100);

-- 3. Enable Row Level Security
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

-- Allow full access to authenticated staff and anon users for read/write
DROP POLICY IF EXISTS "Allow authenticated full access to colors" ON public.colors;
CREATE POLICY "Allow authenticated full access to colors" 
    ON public.colors 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read/write to colors" ON public.colors;
CREATE POLICY "Allow anon read/write to colors" 
    ON public.colors 
    FOR ALL 
    TO anon 
    USING (true) 
    WITH CHECK (true);

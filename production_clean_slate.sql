-- ====================================================================
-- ALMAS ACCESSORIES ERP - PRODUCTION CLEAN SLATE / RESET SCRIPT
-- ====================================================================
-- INSTRUCTIONS: Run this in Supabase SQL Editor to wipe all test/dummy 
-- data (Sales, Purchases, Payments, Expenses, Stock, Products, Contacts) 
-- while PRESERVING User Accounts, Profiles, Branches & Permissions.
-- ====================================================================

-- 1. Temporarily disable triggers to allow fast, clean truncation
SET session_replication_role = 'replica';

-- 2. Truncate all transactional, inventory, catalog, and contact tables
TRUNCATE TABLE 
    public.sale_items,
    public.sales,
    public.purchase_items,
    public.purchases,
    public.payments,
    public.expenses,
    public.cash_ledger,
    public.inventory_movements,
    public.inventory,
    public.products,
    public.colors,
    public.contacts
RESTART IDENTITY CASCADE;

-- 3. Re-enable standard trigger execution
SET session_replication_role = 'origin';

-- 4. Reset product code auto-increment sequence to initial starting value
ALTER SEQUENCE IF EXISTS public.product_code_seq RESTART WITH 10001;

-- 5. Confirmation Verification Query
SELECT 
    (SELECT COUNT(*) FROM public.profiles) AS active_profiles_count,
    (SELECT COUNT(*) FROM public.branches) AS active_branches_count,
    (SELECT COUNT(*) FROM public.products) AS products_count,
    (SELECT COUNT(*) FROM public.inventory) AS inventory_rows_count,
    (SELECT COUNT(*) FROM public.contacts) AS contacts_count,
    (SELECT COUNT(*) FROM public.sales) AS sales_count,
    (SELECT COUNT(*) FROM public.purchases) AS purchases_count,
    (SELECT COUNT(*) FROM public.payments) AS payments_count,
    (SELECT COUNT(*) FROM public.expenses) AS expenses_count;

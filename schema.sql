-- ====================================================================
-- ALMAS ACCESSORIES ERP - COMPLETE MASTER DATABASE SCHEMA
-- ====================================================================
-- INSTRUCTIONS: Run this complete script in the Supabase SQL Editor.
-- It establishes all tables, sequences, functions, triggers, and RLS 
-- policies for a complete, production-ready multi-branch ERP system.
-- ====================================================================

-- 1. DROP EXISTING TRIGGERS & FUNCTIONS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_invoice_payment_totals() CASCADE;
DROP FUNCTION IF EXISTS public.log_sale_item_movement() CASCADE;
DROP FUNCTION IF EXISTS public.log_purchase_item_movement() CASCADE;
DROP FUNCTION IF EXISTS public.generate_sale_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_purchase_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_payment_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_product_code() CASCADE;

-- 2. DROP TABLES IN DEPENDENCY ORDER
DROP TABLE IF EXISTS public.branch_payments CASCADE;
DROP TABLE IF EXISTS public.branch_challan_items CASCADE;
DROP TABLE IF EXISTS public.branch_challans CASCADE;
DROP TABLE IF EXISTS public.cash_ledger CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.purchase_items CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.colors CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;

-- 3. DROP ENUM TYPES & SEQUENCES
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS contact_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_transaction_type CASCADE;
DROP SEQUENCE IF EXISTS product_code_seq CASCADE;
DROP SEQUENCE IF EXISTS branch_challan_seq CASCADE;
DROP SEQUENCE IF EXISTS branch_payment_seq CASCADE;

-- ====================================================================
-- 4. ENUMS & SEQUENCES
-- ====================================================================
CREATE TYPE user_role AS ENUM ('owner', 'factory_manager', 'branch_manager', 'staff');
CREATE TYPE movement_type AS ENUM ('purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out');
CREATE TYPE contact_type AS ENUM ('customer', 'supplier');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'mobile_banking');
CREATE TYPE payment_transaction_type AS ENUM ('customer_collection', 'supplier_payment');

CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS branch_challan_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS branch_payment_seq START WITH 1001;

-- ====================================================================
-- 5. CORE TABLES DEFINITION
-- ====================================================================

-- 5.1 Branches (Showrooms, Factory Hub, Godown)
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    is_factory BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.2 User Profiles (Linked with Supabase Auth & Role-Based Permissions)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    phone VARCHAR(50) UNIQUE,
    full_name VARCHAR(255),
    role user_role DEFAULT 'staff'::user_role NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.3 Role Permissions Master Table
CREATE TABLE public.role_permissions (
    role VARCHAR(50) PRIMARY KEY,
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.4 Color Shades & Shade Cards Master
CREATE TABLE public.colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    shade_card VARCHAR(100) DEFAULT 'Almas Standard',
    hex_code VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(code, shade_card)
);

-- 5.5 Products & Thread Variants
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    color_code VARCHAR(50),
    color_name VARCHAR(100),
    purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    sale_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.6 Branch Inventory (Stock Matrix)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    purchase_price DECIMAL(12, 2),
    sale_price DECIMAL(12, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(branch_id, product_id)
);

-- 5.7 Inventory Movements (Audit Trail)
CREATE TABLE public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.8 Contacts Directory (Customers & Suppliers)
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type contact_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    opening_balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.9 Purchases (Supplier Invoices)
CREATE TABLE public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    supplier_id UUID REFERENCES public.contacts(id) NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status payment_status NOT NULL DEFAULT 'unpaid'::payment_status,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    item_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL
);

-- 5.10 Sales (POS & Wholesale Invoices)
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    customer_id UUID REFERENCES public.contacts(id) NOT NULL,
    sale_date DATE DEFAULT CURRENT_DATE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    tax DECIMAL(12, 2) DEFAULT 0.00,
    net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status payment_status NOT NULL DEFAULT 'unpaid'::payment_status,
    payment_method payment_method DEFAULT 'cash'::payment_method,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    size VARCHAR(100),
    number_of_carton INTEGER DEFAULT 0,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL
);

-- 5.11 Payments & Collections Ledger
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(100) UNIQUE,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    contact_id UUID REFERENCES public.contacts(id) NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method payment_method DEFAULT 'cash'::payment_method,
    transaction_type payment_transaction_type NOT NULL,
    reference_invoice_id UUID,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.12 Expenses Ledger
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method payment_method DEFAULT 'cash'::payment_method,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.13 Cash Ledger
CREATE TABLE public.cash_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    account_type VARCHAR(50) DEFAULT 'cash',
    type VARCHAR(10) DEFAULT 'in',
    transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) DEFAULT 0.00,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.14 Branch Delivery Challans (Factory ➔ Branch Consignment)
CREATE TABLE public.branch_challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_no VARCHAR(50) UNIQUE NOT NULL,
    from_branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
    to_branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
    total_bill_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_no VARCHAR(100),
    driver_name VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.15 Branch Challan Items (Dispatched, Sold, & Remaining Stock)
CREATE TABLE public.branch_challan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_id UUID REFERENCES public.branch_challans(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    dispatched_qty INTEGER NOT NULL CHECK (dispatched_qty > 0),
    sold_qty INTEGER NOT NULL DEFAULT 0 CHECK (sold_qty >= 0),
    remaining_qty INTEGER NOT NULL DEFAULT 0 CHECK (remaining_qty >= 0),
    unit_transfer_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.16 Branch Payments (Branch ➔ Factory Settlement Audit)
CREATE TABLE public.branch_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT NOT NULL,
    challan_id UUID REFERENCES public.branch_challans(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 6. AUTOMATION TRIGGERS & PROCEDURES
-- ====================================================================

-- 6.1 Auto-Generate Product Code Trigger
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL OR NEW.product_code = '' THEN
        NEW.product_code := 'PRD-' || LPAD(nextval('product_code_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_product_code
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_product_code();

-- 6.2 Auto-Create User Profile on Auth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    user_phone VARCHAR(50);
BEGIN
    SELECT count(*) = 0 INTO is_first_user FROM public.profiles;
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email, '@', 1));

    INSERT INTO public.profiles (id, phone, full_name, role, branch_id, permissions)
    VALUES (
        NEW.id,
        user_phone,
        COALESCE(NEW.raw_user_meta_data->>'full_name', user_phone),
        CASE WHEN is_first_user THEN 'owner'::user_role ELSE 'staff'::user_role END,
        NULL,
        '[]'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
        phone = EXCLUDED.phone,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6.3 Auto-Confirm Email on User Creation
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_user
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_new_user();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6.4 Admin User Deletion Procedure
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated, anon;

-- 6.5 Admin User Password Reset Procedure
CREATE OR REPLACE FUNCTION public.update_user_password_by_admin(target_user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

GRANT EXECUTE ON FUNCTION public.update_user_password_by_admin(UUID, TEXT) TO authenticated, anon;

-- ====================================================================
-- 7. PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON public.inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch ON public.inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON public.payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_branch ON public.cash_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_challans_from_branch ON public.branch_challans(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_challans_to_branch ON public.branch_challans(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_payments_branch ON public.branch_payments(branch_id);

-- ====================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated & anon access
CREATE POLICY "Allow authenticated full access to branches" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to branches" ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to profiles" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to role_permissions" ON public.role_permissions FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to colors" ON public.colors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to colors" ON public.colors FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to inventory" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to inventory" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to inventory_movements" ON public.inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to inventory_movements" ON public.inventory_movements FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to contacts" ON public.contacts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to purchases" ON public.purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to purchases" ON public.purchases FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to purchase_items" ON public.purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to purchase_items" ON public.purchase_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to sales" ON public.sales FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to sale_items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to sale_items" ON public.sale_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to payments" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to expenses" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to cash_ledger" ON public.cash_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write to cash_ledger" ON public.cash_ledger FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to branch_challans" ON public.branch_challans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access to branch_challans" ON public.branch_challans FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to branch_challan_items" ON public.branch_challan_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access to branch_challan_items" ON public.branch_challan_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to branch_payments" ON public.branch_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access to branch_payments" ON public.branch_payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- ====================================================================
-- 9. PERFORMANCE & SEARCH INDEXES (High Performance Tuning)
-- ====================================================================
-- Sales & Sale Items
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON public.sales (branch_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON public.sales (invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales (payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items (product_id);

-- Purchases & Purchase Items
CREATE INDEX IF NOT EXISTS idx_purchases_branch_date ON public.purchases (branch_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_number ON public.purchases (invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON public.purchases (payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON public.purchase_items (product_id);

-- Inventory & Movements
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON public.inventory (branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory (quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_created ON public.inventory_movements (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements (type);

-- Challans & Challan Items
CREATE INDEX IF NOT EXISTS idx_branch_challans_from_branch ON public.branch_challans (from_branch_id, challan_date DESC);
CREATE INDEX IF NOT EXISTS idx_branch_challans_to_branch ON public.branch_challans (to_branch_id, challan_date DESC);
CREATE INDEX IF NOT EXISTS idx_branch_challans_challan_no ON public.branch_challans (challan_no);
CREATE INDEX IF NOT EXISTS idx_branch_challans_payment_status ON public.branch_challans (payment_status);
CREATE INDEX IF NOT EXISTS idx_branch_challan_items_challan_id ON public.branch_challan_items (challan_id);
CREATE INDEX IF NOT EXISTS idx_branch_challan_items_product_id ON public.branch_challan_items (product_id);

-- Branch Payments
CREATE INDEX IF NOT EXISTS idx_branch_payments_challan_id ON public.branch_payments (challan_id);
CREATE INDEX IF NOT EXISTS idx_branch_payments_from_branch ON public.branch_payments (from_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_payments_to_branch ON public.branch_payments (to_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_payments_status ON public.branch_payments (status);

-- Financial Ledgers: Payments, Expenses, Cash Ledger
CREATE INDEX IF NOT EXISTS idx_payments_branch_date ON public.payments (branch_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id ON public.payments (contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref_invoice ON public.payments (reference_invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON public.expenses (branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_branch_date ON public.cash_ledger (branch_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_ref ON public.cash_ledger (reference_id);

-- Contacts, Products, Profiles
CREATE INDEX IF NOT EXISTS idx_contacts_branch_type ON public.contacts (branch_id, type);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts (name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products (product_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles (branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);


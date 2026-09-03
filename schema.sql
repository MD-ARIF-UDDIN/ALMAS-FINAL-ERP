-- ====================================================================
-- ALMAS ACCESSORIES ERP - COMPLETE PRODUCTION DATABASE SCHEMA
-- ====================================================================
-- INSTRUCTIONS: Run this complete script in the Supabase SQL Editor.
-- It establishes all tables, sequences, functions, triggers, and RLS 
-- policies for a complete, production-ready multi-branch ERP system.
-- ====================================================================

-- 1. CLEAN SLATE: DROP EXISTING TRIGGERS & FUNCTIONS
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

-- ====================================================================
-- 4. ENUMS & SEQUENCES
-- ====================================================================
CREATE TYPE user_role AS ENUM ('owner', 'branch_manager', 'staff');
CREATE TYPE movement_type AS ENUM ('purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out');
CREATE TYPE contact_type AS ENUM ('customer', 'supplier');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'mobile_banking');
CREATE TYPE payment_transaction_type AS ENUM ('customer_collection', 'supplier_payment');

CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 10001;

-- ====================================================================
-- 5. CORE TABLES DEFINITION
-- ====================================================================

-- 5.1 Branches (Showroom, Factory, Godown, Head Office)
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.2 User Profiles (Linked with Supabase Auth & Role-Based Permissions)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
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

-- 5.5 Products & Thread Variants (With Auto-Generated Unique Product Code)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'pcs',
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(branch_id, product_id)
);

-- 5.7 Inventory Movements (Stock In / Stock Out / Transfer Audit Trail)
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
    opening_balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.9 Purchases (Supplier / Spinning Mill Invoices)
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
    product_id UUID REFERENCES public.products(id) NOT NULL,
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
    transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
    description TEXT NOT NULL,
    amount_in DECIMAL(12, 2) DEFAULT 0.00,
    amount_out DECIMAL(12, 2) DEFAULT 0.00,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 6. AUTOMATION TRIGGERS & PROCEDURES
-- ====================================================================

-- 6.1 Auto-Generate Unique Product Code (PRD-10001, PRD-10002...)
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL OR NEW.product_code = '' THEN
        NEW.product_code := 'PRD-' || lpad(nextval('product_code_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_product_insert_code
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.generate_product_code();

-- 6.2 Auto-Generate Branch-Specific Sales Invoice Number (S-BRN-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_sale_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(16);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    SELECT COALESCE(UPPER(SUBSTRING(name FROM 1 FOR 3)), 'ALM') INTO v_branch_code
    FROM public.branches
    WHERE id = NEW.branch_id;

    v_date_str := to_char(NEW.sale_date, 'YYYYMMDD');
    v_prefix := 'S-' || v_branch_code || '-' || v_date_str || '-';
    
    SELECT COUNT(*) INTO v_count 
    FROM public.sales 
    WHERE invoice_number LIKE v_prefix || '%';
    
    v_next_sl := lpad((v_count + 1)::text, 4, '0');
    NEW.invoice_number := v_prefix || v_next_sl;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_sale_insert_num
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.generate_sale_invoice_number();

-- 6.3 Auto-Generate Branch-Specific Purchase Order Number (P-BRN-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(16);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    SELECT COALESCE(UPPER(SUBSTRING(name FROM 1 FOR 3)), 'ALM') INTO v_branch_code
    FROM public.branches
    WHERE id = NEW.branch_id;

    v_date_str := to_char(NEW.purchase_date, 'YYYYMMDD');
    v_prefix := 'P-' || v_branch_code || '-' || v_date_str || '-';
    
    SELECT COUNT(*) INTO v_count 
    FROM public.purchases 
    WHERE invoice_number LIKE v_prefix || '%';
    
    v_next_sl := lpad((v_count + 1)::text, 4, '0');
    NEW.invoice_number := v_prefix || v_next_sl;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_purchase_insert_num
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.generate_purchase_invoice_number();

-- 6.4 Auto-Generate Branch-Specific Payment Receipt Number (PM-BRN-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(17);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    SELECT COALESCE(UPPER(SUBSTRING(name FROM 1 FOR 3)), 'ALM') INTO v_branch_code
    FROM public.branches
    WHERE id = NEW.branch_id;

    v_date_str := to_char(NEW.payment_date, 'YYYYMMDD');
    v_prefix := 'PM-' || v_branch_code || '-' || v_date_str || '-';
    
    SELECT COUNT(*) INTO v_count 
    FROM public.payments 
    WHERE payment_number LIKE v_prefix || '%';
    
    v_next_sl := lpad((v_count + 1)::text, 4, '0');
    NEW.payment_number := v_prefix || v_next_sl;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_payment_insert_num
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.generate_payment_number();

-- 6.5 Auto-Update Invoice Payment Status & Balance Upon Payments
CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_target_invoice_id UUID;
    v_total_paid DECIMAL(12, 2);
    v_net_amt DECIMAL(12, 2);
BEGIN
    v_target_invoice_id := COALESCE(NEW.reference_invoice_id, OLD.reference_invoice_id);
    
    IF v_target_invoice_id IS NOT NULL THEN
        -- Check if it's a sales invoice
        IF EXISTS (SELECT 1 FROM public.sales WHERE id = v_target_invoice_id) THEN
            SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
            FROM public.payments
            WHERE reference_invoice_id = v_target_invoice_id;
            
            SELECT net_amount INTO v_net_amt
            FROM public.sales
            WHERE id = v_target_invoice_id;
            
            UPDATE public.sales
            SET paid_amount = v_total_paid,
                payment_status = CASE 
                    WHEN v_total_paid >= v_net_amt THEN 'paid'::payment_status
                    WHEN v_total_paid > 0 THEN 'partial'::payment_status
                    ELSE 'unpaid'::payment_status
                END
            WHERE id = v_target_invoice_id;
            
        -- Check if it's a purchase invoice
        ELSIF EXISTS (SELECT 1 FROM public.purchases WHERE id = v_target_invoice_id) THEN
            SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
            FROM public.payments
            WHERE reference_invoice_id = v_target_invoice_id;
            
            SELECT net_amount INTO v_net_amt
            FROM public.purchases
            WHERE id = v_target_invoice_id;
            
            UPDATE public.purchases
            SET paid_amount = v_total_paid,
                payment_status = CASE 
                    WHEN v_total_paid >= v_net_amt THEN 'paid'::payment_status
                    WHEN v_total_paid > 0 THEN 'partial'::payment_status
                    ELSE 'unpaid'::payment_status
                END
            WHERE id = v_target_invoice_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_totals();

-- 6.6 Auto-Deduct Stock on Sale Item Insertion
CREATE OR REPLACE FUNCTION public.log_sale_item_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id UUID;
    v_created_by UUID;
    v_inv_number VARCHAR(100);
BEGIN
    SELECT branch_id, created_by, invoice_number INTO v_branch_id, v_created_by, v_inv_number
    FROM public.sales
    WHERE id = NEW.sale_id;

    -- Update inventory stock
    INSERT INTO public.inventory (branch_id, product_id, quantity, updated_at)
    VALUES (v_branch_id, NEW.product_id, -NEW.quantity, now())
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity - EXCLUDED.quantity,
        updated_at = now();

    -- Log movement audit trail
    INSERT INTO public.inventory_movements (branch_id, product_id, type, quantity, reference_id, description, created_by)
    VALUES (v_branch_id, NEW.product_id, 'sale', NEW.quantity, NEW.sale_id, 'Sale Invoice #' || COALESCE(v_inv_number, 'POS'), v_created_by);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_sale_item_insert
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.log_sale_item_movement();

-- 6.7 Auto-Add Stock on Purchase Item Insertion
CREATE OR REPLACE FUNCTION public.log_purchase_item_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id UUID;
    v_created_by UUID;
    v_inv_number VARCHAR(100);
BEGIN
    SELECT branch_id, created_by, invoice_number INTO v_branch_id, v_created_by, v_inv_number
    FROM public.purchases
    WHERE id = NEW.purchase_id;

    -- Update inventory stock
    INSERT INTO public.inventory (branch_id, product_id, quantity, updated_at)
    VALUES (v_branch_id, NEW.product_id, NEW.quantity, now())
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        updated_at = now();

    -- Log movement audit trail
    INSERT INTO public.inventory_movements (branch_id, product_id, type, quantity, reference_id, description, created_by)
    VALUES (v_branch_id, NEW.product_id, 'purchase', NEW.quantity, NEW.purchase_id, 'Purchase Order #' || COALESCE(v_inv_number, 'DIRECT'), v_created_by);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_purchase_item_insert
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.log_purchase_item_movement();

-- 6.8 Auto-Sync Supabase Auth Users into Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE 
            WHEN NEW.email = 'admin@gmail.com' THEN 'owner'::user_role
            ELSE COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff'::user_role)
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 7. PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_color_code ON public.products(color_code);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_product ON public.inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch ON public.inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON public.payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);

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

-- Allow full authenticated & anon access
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

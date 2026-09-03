-- ====================================================================
-- ALMAS ACCESSORIES ERP - COMPLETE PRODUCTION SETUP SCRIPT
-- ====================================================================
-- INSTRUCTIONS: Run this complete script in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Run)
-- It establishes all tables, sequences, functions, triggers, RLS 
-- policies, master data, and seeds the owner account (almas@admin.com).
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CLEAN SLATE: DROP EXISTING TRIGGERS & FUNCTIONS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_invoice_payment_totals() CASCADE;
DROP FUNCTION IF EXISTS public.log_sale_item_movement() CASCADE;
DROP FUNCTION IF EXISTS public.log_purchase_item_movement() CASCADE;
DROP FUNCTION IF EXISTS public.generate_sale_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_purchase_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_payment_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_product_code() CASCADE;

-- 3. DROP TABLES IN REVERSE DEPENDENCY ORDER
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

-- 4. DROP ENUM TYPES & SEQUENCES
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS contact_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_transaction_type CASCADE;
DROP SEQUENCE IF EXISTS product_code_seq CASCADE;

-- ====================================================================
-- 5. ENUMS & SEQUENCES
-- ====================================================================
CREATE TYPE user_role AS ENUM ('owner', 'branch_manager', 'staff');
CREATE TYPE movement_type AS ENUM ('purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out');
CREATE TYPE contact_type AS ENUM ('customer', 'supplier');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'mobile_banking');
CREATE TYPE payment_transaction_type AS ENUM ('customer_collection', 'supplier_payment');

CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 10001;

-- ====================================================================
-- 6. CORE TABLES DEFINITION
-- ====================================================================

-- 6.1 Branches (Showroom, Factory, Godown, Head Office)
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.2 User Profiles (Linked with Supabase Auth & Role-Based Permissions)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'staff'::user_role NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.3 Role Permissions Master Table
CREATE TABLE public.role_permissions (
    role VARCHAR(50) PRIMARY KEY,
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.4 Color Shades & Shade Cards Master
CREATE TABLE public.colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    shade_card VARCHAR(100) DEFAULT 'Almas Standard',
    hex_code VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(code, shade_card)
);

-- 6.5 Products & Thread Variants (With Auto-Generated Unique Product Code)
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

-- 6.6 Branch Inventory (Stock Matrix)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(branch_id, product_id)
);

-- 6.7 Inventory Movements (Stock In / Stock Out / Transfer Audit Trail)
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

-- 6.8 Contacts Directory (Customers & Suppliers)
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

-- 6.9 Purchases (Supplier / Spinning Mill Invoices)
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

-- 6.10 Sales (POS & Wholesale Invoices)
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

-- 6.11 Payments & Collections Ledger
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

-- 6.12 Expenses Ledger
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

-- 6.13 Cash Ledger
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
-- 7. AUTOMATION TRIGGERS & PROCEDURES
-- ====================================================================

-- 7.1 Auto-Generate Unique Product Code (PRD-10001, PRD-10002...)
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

-- 7.2 Auto-Generate Branch-Specific Sales Invoice Number (S-BRN-YYYYMMDD-XXXX)
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

-- 7.3 Auto-Generate Branch-Specific Purchase Order Number (P-BRN-YYYYMMDD-XXXX)
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

-- 7.4 Auto-Generate Branch-Specific Payment Receipt Number (PM-BRN-YYYYMMDD-XXXX)
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

-- 7.5 Auto-Update Invoice Payment Status & Balance Upon Payments
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

-- 7.6 Auto-Deduct Stock on Sale Item Insertion
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

-- 7.7 Auto-Add Stock on Purchase Item Insertion
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

-- 7.8 Auto-Sync Supabase Auth Users into Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE 
            WHEN NEW.email IN ('almas@admin.com', 'admin@gmail.com') THEN 'owner'::user_role
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
-- 8. PERFORMANCE INDEXES
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
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
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

-- ====================================================================
-- 10. MASTER SEED DATA
-- ====================================================================

-- 10.1 Branches
INSERT INTO public.branches (id, name, address, phone) VALUES
('a0000000-0000-0000-0000-000000000001', 'Main Showroom', 'Shop #12, Islampur Market, Dhaka', '+880 1711-000001'),
('a0000000-0000-0000-0000-000000000002', 'Central Godown', 'Plot 45, Narayanganj Industrial Area', '+880 1711-000002'),
('a0000000-0000-0000-0000-000000000003', 'Factory Unit 1', 'Gazipur BSCIC, Dhaka', '+880 1711-000003'),
('a0000000-0000-0000-0000-000000000004', 'Chittagong Depot', 'Khatunganj Commercial Area, Chittagong', '+880 1711-000004')
ON CONFLICT (id) DO NOTHING;

-- 10.2 Role Permissions Defaults
INSERT INTO public.role_permissions (role, permissions, updated_at) VALUES
('branch_manager', '["product.items_view", "product.items_create", "product.shades_view", "product.shades_create", "inventory.stock_view", "inventory.adjust", "inventory.transfer_view", "inventory.transfer", "inventory.logs_view", "sales.view", "sales.pos_view", "sales.create", "purchases.view", "purchases.new_view", "purchases.create", "payments.view", "payments.create", "expenses.view", "expenses.create", "contacts.view", "contacts.create", "contacts.edit", "reports.view"]'::jsonb, now()),
('staff', '["product.items_view", "product.shades_view", "inventory.stock_view", "sales.view", "sales.pos_view", "sales.create", "payments.view", "payments.create", "contacts.view", "contacts.create"]'::jsonb, now())
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

-- 10.3 Color Shades
INSERT INTO public.colors (code, name, shade_card, hex_code) VALUES
('WH-01', 'Bleached White', 'Almas Standard', '#FFFFFF'),
('BK-01', 'Jet Black', 'Almas Standard', '#0A0A0A'),
('NV-02', 'Deep Navy', 'Almas Standard', '#0F172A'),
('RD-05', 'Crimson Red', 'Almas Standard', '#DC2626'),
('RY-03', 'Royal Blue', 'Almas Standard', '#2563EB'),
('GN-04', 'Forest Olive', 'Almas Standard', '#166534'),
('YL-01', 'Golden Yellow', 'Almas Standard', '#CA8A04'),
('OR-02', 'Vibrant Orange', 'Almas Standard', '#EA580C'),
('GY-01', 'Heather Grey', 'Almas Standard', '#64748B'),
('PK-01', 'Baby Pink', 'Almas Standard', '#F472B6')
ON CONFLICT (code, shade_card) DO NOTHING;

-- 10.4 Sample Products
INSERT INTO public.products (product_code, sku, name, description, category, unit, color_code, color_name, purchase_price, sale_price) VALUES
('PRD-10001', 'THR-402-WH01', 'Sewing Thread 40/2 5000M - White', '100% Spun Polyester high-speed sewing thread', 'Sewing Thread', 'cones', 'WH-01', 'Bleached White', 95.00, 125.00),
('PRD-10002', 'THR-402-BK01', 'Sewing Thread 40/2 5000M - Black', '100% Spun Polyester high-speed sewing thread', 'Sewing Thread', 'cones', 'BK-01', 'Jet Black', 95.00, 125.00),
('PRD-10003', 'THR-402-NV02', 'Sewing Thread 40/2 5000M - Deep Navy', '100% Spun Polyester high-speed sewing thread', 'Sewing Thread', 'cones', 'NV-02', 'Deep Navy', 98.00, 130.00),
('PRD-10004', 'THR-202-WH01', 'Heavy Duty Thread 20/2 3000M - White', 'High tenacity polyester for denim and workwear', 'Heavy Thread', 'cones', 'WH-01', 'Bleached White', 140.00, 185.00),
('PRD-10005', 'THR-202-BK01', 'Heavy Duty Thread 20/2 3000M - Black', 'High tenacity polyester for denim and workwear', 'Heavy Thread', 'cones', 'BK-01', 'Jet Black', 140.00, 185.00),
('PRD-10006', 'ELT-075-WH01', 'Woven Elastic Tape 3/4 Inch (20mm)', 'Premium stretch knitted elastic roll (100 Yards)', 'Elastic Tape', 'rolls', 'WH-01', 'Bleached White', 320.00, 420.00),
('PRD-10007', 'ELT-100-BK01', 'Woven Elastic Tape 1.0 Inch (25mm)', 'Premium stretch knitted elastic roll (100 Yards)', 'Elastic Tape', 'rolls', 'BK-01', 'Jet Black', 380.00, 495.00)
ON CONFLICT (sku) DO NOTHING;

-- 10.5 Initial Stock for Sample Products in Main Showroom & Central Godown
INSERT INTO public.inventory (branch_id, product_id, quantity, min_stock_level)
SELECT 'a0000000-0000-0000-0000-000000000001', id, 250, 20 FROM public.products
ON CONFLICT (branch_id, product_id) DO NOTHING;

INSERT INTO public.inventory (branch_id, product_id, quantity, min_stock_level)
SELECT 'a0000000-0000-0000-0000-000000000002', id, 1000, 50 FROM public.products
ON CONFLICT (branch_id, product_id) DO NOTHING;

-- 10.6 Default Sample Contacts
INSERT INTO public.contacts (name, type, phone, email, address, opening_balance) VALUES
('Ananta Garments Ltd', 'customer', '+880 1819-112233', 'procurement@ananta.com', 'Plot 14, Sector 7, Uttara EPZ, Dhaka', 0.00),
('Ha-Meem Group Textiles', 'customer', '+880 1912-334455', 'textiles@hameemgroup.com', 'Tejgaon I/A, Dhaka', 0.00),
('Square Fashions Sourcing', 'customer', '+880 1713-998877', 'accessories@squaregroup.com', 'Square Tower, Mohakhali, Dhaka', 0.00),
('Padma Spinning Mills Ltd', 'supplier', '+880 1714-445566', 'sales@padmaspinning.com', 'Adamjee EPZ, Narayanganj', 0.00),
('Bengal Dyes & Chemicals Ltd', 'supplier', '+880 1715-778899', 'orders@bengaldyes.com', 'Tongi I/A, Gazipur', 0.00);

-- ====================================================================
-- 11. SEED OWNER USER (almas@admin.com / almas12345)
-- ====================================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'almas@admin.com';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
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
    UPDATE auth.users
    SET encrypted_password = crypt('almas12345', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = '{"full_name":"Almas Admin"}'::jsonb,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, 'almas@admin.com', 'Almas Admin', 'owner'::public.user_role)
  ON CONFLICT (id) DO UPDATE
  SET role = 'owner'::public.user_role,
      email = EXCLUDED.email,
      full_name = 'Almas Admin';

END $$;

-- ====================================================================
-- SQL UPDATE SCRIPT - UPDATE INVOICE GENERATOR FUNCTIONS
-- ====================================================================
-- INSTRUCTIONS: Copy this entire script and run it in the SQL Editor
-- of your Supabase dashboard to update active invoice numbers layout.
-- ====================================================================

-- 1. Update Sales Invoice Number Generator (S-ALM-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_sale_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(16);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    -- Get the first 3 characters of the branch name (uppercased)
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

-- 2. Update Purchases Bill Number Generator (P-ALM-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(16);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    -- Get the first 3 characters of the branch name (uppercased)
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

-- 3. Update Payment Reference Number Generator (PM-ALM-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_branch_code VARCHAR(3);
    v_prefix VARCHAR(17);
    v_count INTEGER;
    v_next_sl VARCHAR(4);
BEGIN
    -- Get the first 3 characters of the branch name (uppercased)
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

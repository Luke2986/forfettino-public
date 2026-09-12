-- ============================================
-- FORFETTO DATABASE SCHEMA
-- Gestionale per Partite IVA Regime Forfettario
-- ============================================

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. PROFIT COEFFICIENT PRESETS (ATECO codes)
-- ============================================
CREATE TABLE public.profit_coeff_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ateco_code TEXT NOT NULL,
    description TEXT NOT NULL,
    coefficient NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (public read)
ALTER TABLE public.profit_coeff_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presets"
    ON public.profit_coeff_presets FOR SELECT
    USING (true);

-- Insert common presets
INSERT INTO public.profit_coeff_presets (ateco_code, description, coefficient) VALUES
    ('62.01', 'Produzione software', 67),
    ('62.02', 'Consulenza informatica', 78),
    ('70.22', 'Consulenza gestionale', 78),
    ('73.11', 'Agenzie pubblicitarie', 78),
    ('74.10', 'Design e comunicazione visiva', 78),
    ('74.20', 'Attività fotografiche', 78),
    ('74.90', 'Altre attività professionali', 78),
    ('85.59', 'Formazione e corsi', 78),
    ('63.11', 'Elaborazione dati e hosting', 67),
    ('47.91', 'Commercio elettronico', 40),
    ('96.09', 'Altri servizi alla persona', 67);

-- ============================================
-- 3. FISCAL YEAR SETTINGS
-- ============================================
CREATE TABLE public.fiscal_year_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    
    -- Tax settings
    tax_rate NUMERIC(4,2) NOT NULL DEFAULT 15.00, -- 5% or 15%
    profit_coefficient NUMERIC(5,2) NOT NULL DEFAULT 78.00, -- 40-86%
    
    -- INPS settings
    inps_rate NUMERIC(5,2) NOT NULL DEFAULT 26.07, -- Gestione Separata rate
    inps_type TEXT NOT NULL DEFAULT 'gestione_separata',
    
    -- Prudence parameters
    safety_buffer_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00, -- Extra buffer %
    deadline_window_days INTEGER NOT NULL DEFAULT 45, -- Days before deadline to consider
    buffer_base TEXT NOT NULL DEFAULT 'receipts', -- 'receipts' or 'reserve'
    
    -- Reserve
    reserve_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, fiscal_year)
);

-- Enable RLS
ALTER TABLE public.fiscal_year_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fiscal settings"
    ON public.fiscal_year_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fiscal settings"
    ON public.fiscal_year_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fiscal settings"
    ON public.fiscal_year_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fiscal settings"
    ON public.fiscal_year_settings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. CLIENTS (Address Book)
-- ============================================
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    vat_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients"
    ON public.clients FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
    ON public.clients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
    ON public.clients FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
    ON public.clients FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 5. RECEIPTS (Incassi)
-- ============================================
CREATE TABLE public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    gross_amount NUMERIC(12,2) NOT NULL,
    client_name TEXT, -- Denormalized for quick display
    notes TEXT,
    
    -- Computed breakdown (stored for history)
    taxable_amount NUMERIC(12,2), -- gross * coefficient
    tax_amount NUMERIC(12,2), -- taxable * tax_rate
    inps_amount NUMERIC(12,2), -- taxable * inps_rate
    net_spendable NUMERIC(12,2), -- gross - tax - inps
    
    fiscal_year INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own receipts"
    ON public.receipts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts"
    ON public.receipts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
    ON public.receipts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts"
    ON public.receipts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 6. TOOL SUBSCRIPTIONS (Costi Ricorrenti)
-- ============================================
CREATE TABLE public.tool_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    cost NUMERIC(10,2) NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'yearly'
    renewal_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tool_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
    ON public.tool_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
    ON public.tool_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
    ON public.tool_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
    ON public.tool_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 7. TAX SCHEDULE (Scadenziario)
-- ============================================
CREATE TABLE public.tax_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    payment_year INTEGER NOT NULL, -- Year when payment is due
    reference_year INTEGER NOT NULL, -- Fiscal year the payment refers to
    bucket TEXT NOT NULL, -- 'june' or 'november'
    due_date DATE NOT NULL,
    
    -- Amounts
    tax_balance NUMERIC(12,2) NOT NULL DEFAULT 0, -- Saldo imposta
    tax_advance NUMERIC(12,2) NOT NULL DEFAULT 0, -- Acconto imposta
    inps_balance NUMERIC(12,2) NOT NULL DEFAULT 0, -- Saldo INPS
    inps_advance NUMERIC(12,2) NOT NULL DEFAULT 0, -- Acconto INPS
    
    total_expected NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'partial', 'paid'
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, payment_year, bucket)
);

-- Enable RLS
ALTER TABLE public.tax_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tax schedule"
    ON public.tax_schedule FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tax schedule"
    ON public.tax_schedule FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tax schedule"
    ON public.tax_schedule FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tax schedule"
    ON public.tax_schedule FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 8. PAYMENTS (F24)
-- ============================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tax_schedule_id UUID REFERENCES public.tax_schedule(id) ON DELETE SET NULL,
    
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_type TEXT NOT NULL, -- 'tax', 'inps', 'mixed'
    amount NUMERIC(12,2) NOT NULL,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
    ON public.payments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
    ON public.payments FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fiscal_year_settings_updated_at
    BEFORE UPDATE ON public.fiscal_year_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
    BEFORE UPDATE ON public.receipts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tool_subscriptions_updated_at
    BEFORE UPDATE ON public.tool_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_schedule_updated_at
    BEFORE UPDATE ON public.tax_schedule
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update tax_schedule when payment is made
-- ============================================
CREATE OR REPLACE FUNCTION public.update_tax_schedule_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tax_schedule_id IS NOT NULL THEN
        UPDATE public.tax_schedule
        SET 
            total_paid = (
                SELECT COALESCE(SUM(amount), 0)
                FROM public.payments
                WHERE tax_schedule_id = NEW.tax_schedule_id
            ),
            status = CASE
                WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = NEW.tax_schedule_id) >= total_expected THEN 'paid'
                WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = NEW.tax_schedule_id) > 0 THEN 'partial'
                ELSE 'open'
            END
        WHERE id = NEW.tax_schedule_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_insert
    AFTER INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_tax_schedule_on_payment();

CREATE TRIGGER on_payment_update
    AFTER UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_tax_schedule_on_payment();
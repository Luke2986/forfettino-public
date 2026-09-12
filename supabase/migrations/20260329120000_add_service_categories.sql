-- ============================================
-- SERVICE CATEGORIES
-- Categorie di servizio personalizzate per taggare gli incassi
-- Epic 55, Story 55-1
-- ============================================

-- 1. CREATE TABLE service_categories
CREATE TABLE public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Functional unique index: case-insensitive name per user
CREATE UNIQUE INDEX service_categories_user_name_unique
    ON public.service_categories (user_id, lower(name));

-- Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (4 standard, pattern clients)
CREATE POLICY "Users can view their own service categories"
    ON public.service_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own service categories"
    ON public.service_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own service categories"
    ON public.service_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own service categories"
    ON public.service_categories FOR DELETE
    USING (auth.uid() = user_id);

-- 2. ALTER TABLE receipts: add service_category_id FK
ALTER TABLE public.receipts
    ADD COLUMN service_category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- 3. Composite index on receipts for aggregate queries (Stories 55.3-55.5)
CREATE INDEX receipts_user_service_category_idx
    ON public.receipts (user_id, service_category_id);

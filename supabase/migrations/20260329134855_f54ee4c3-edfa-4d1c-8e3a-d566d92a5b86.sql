-- SERVICE CATEGORIES table
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

CREATE UNIQUE INDEX service_categories_user_name_unique
    ON public.service_categories (user_id, lower(name));

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.receipts
    ADD COLUMN service_category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

CREATE INDEX receipts_user_service_category_idx
    ON public.receipts (user_id, service_category_id);
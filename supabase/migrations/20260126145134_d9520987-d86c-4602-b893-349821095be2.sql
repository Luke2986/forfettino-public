-- Fix function search_path for security

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix handle_new_user
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_tax_schedule_on_payment
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Fix update_tax_schedule_on_payment to validate user_id match between payment and tax_schedule
CREATE OR REPLACE FUNCTION public.update_tax_schedule_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.tax_schedule_id IS NOT NULL THEN
        -- Validate that the tax_schedule belongs to the same user as the payment
        IF NOT EXISTS (
            SELECT 1 FROM public.tax_schedule
            WHERE id = NEW.tax_schedule_id
            AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Payment and tax schedule user mismatch';
        END IF;
        
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
$function$;
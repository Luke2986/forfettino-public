CREATE OR REPLACE FUNCTION public.increment_analytics_event(p_event_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF p_event_name NOT IN (
    'page_view_dashboard', 'page_view_scadenziario', 'incasso_creato',
    'scadenza_pagata', 'onboarding_completato', 'checklist_dismissed', 'notifica_letta'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.analytics_events (event_name, date, count)
  VALUES (p_event_name, CURRENT_DATE, 1)
  ON CONFLICT (event_name, date)
  DO UPDATE SET count = analytics_events.count + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_admin_override_tier()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF OLD.admin_override_tier IS DISTINCT FROM NEW.admin_override_tier THEN
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      ) THEN
        NEW.admin_override_tier := OLD.admin_override_tier;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
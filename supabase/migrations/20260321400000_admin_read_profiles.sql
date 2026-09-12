-- Allow admins to read all profiles (needed for NPS Dashboard, Pricing Survey, etc.)
-- Uses existing has_role() SECURITY DEFINER function from user_roles migration.

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.has_role(auth.uid(), 'admin')
    );

-- Drop the old restrictive policy so the new one takes effect without conflict
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

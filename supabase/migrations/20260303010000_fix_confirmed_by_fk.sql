-- Fix: contribution_rewards.confirmed_by ha ON DELETE NO ACTION (default)
-- che blocca auth.admin.deleteUser() quando un admin ha confermato un premio.
-- Cambiamo in ON DELETE SET NULL: se l'admin viene eliminato, il premio resta
-- ma confirmed_by diventa NULL.

ALTER TABLE public.contribution_rewards
  DROP CONSTRAINT contribution_rewards_confirmed_by_fkey;

ALTER TABLE public.contribution_rewards
  ADD CONSTRAINT contribution_rewards_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;

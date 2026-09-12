-- Remove public leaderboard RPC — leaderboard is admin-only.
DROP FUNCTION IF EXISTS public.get_leaderboard(INTEGER);

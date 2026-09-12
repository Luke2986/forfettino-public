import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ValidateResult {
  found: boolean;
  firstName: string | null;
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useValidateUserCode(userCode: string) {
  const trimmed = userCode.trim().toUpperCase();
  const debounced = useDebouncedValue(trimmed, 400);
  const enabled = debounced.length >= 3;

  return useQuery<ValidateResult>({
    queryKey: ["validate-user-code", debounced],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("user_code", debounced)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { found: false, firstName: null };
      return { found: true, firstName: data.first_name ?? null };
    },
    enabled,
    staleTime: 30_000,
  });
}

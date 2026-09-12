import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminQualifiedUser {
  userId: string;
  email: string;
  firstName: string | null;
  userCode: string;
  receiptCount: number;
  inpsType: string | null;
  createdAt: string;
  emailConsent: boolean;
}

export function useAdminQualifiedUsers(minReceipts: number, enabled = true) {
  return useQuery<AdminQualifiedUser[]>({
    queryKey: ["admin-qualified-users", minReceipts],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_admin_qualified_users" as any,
        { p_min_receipts: minReceipts },
      );
      if (error) {
        console.warn("get_admin_qualified_users RPC error:", error);
        throw error;
      }
      return ((data as any[]) ?? []).map((row: any) => ({
        userId: row.user_id,
        email: row.email,
        firstName: row.first_name ?? null,
        userCode: row.user_code,
        receiptCount: Number(row.receipt_count),
        inpsType: row.inps_type ?? null,
        createdAt: row.created_at,
        emailConsent: Boolean(row.email_consent),
      }));
    },
    enabled,
    staleTime: 60_000,
  });
}

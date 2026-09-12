import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Milestone } from "@/lib/contribution-helpers";

// --- Admin Milestone Queries ---

export interface AdminMilestone extends Milestone {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch ALL milestones (including inactive) for admin management.
 */
export function useAdminMilestones() {
  return useQuery<AdminMilestone[]>({
    queryKey: ["admin-milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_milestones" as any)
        .select("*")
        .order("level", { ascending: true });
      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];
      return (data as any[]).map((row) => ({
        id: row.id,
        level: row.level,
        name: row.name,
        pointsRequired: row.points_required,
        rewardType: row.reward_type,
        rewardLabel: row.reward_label,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    staleTime: 60_000,
  });
}

// --- Admin Milestone Mutations ---

export function useAdminUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      pointsRequired: number;
      rewardType: string;
      rewardLabel: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase.rpc("admin_update_milestone" as any, {
        p_id: params.id,
        p_name: params.name,
        p_points_required: params.pointsRequired,
        p_reward_type: params.rewardType,
        p_reward_label: params.rewardLabel,
        p_is_active: params.isActive,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useAdminCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      level: number;
      name: string;
      pointsRequired: number;
      rewardType: string;
      rewardLabel: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_create_milestone" as any, {
        p_level: params.level,
        p_name: params.name,
        p_points_required: params.pointsRequired,
        p_reward_type: params.rewardType,
        p_reward_label: params.rewardLabel,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

export function useAdminDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_milestone" as any, {
        p_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
    },
  });
}

// --- Admin Milestone Claims ---

export interface MilestoneAchiever {
  userId: string;
  userCode: string;
  firstName: string | null;
  totalPts: number;
  milestoneId: string;
  milestoneLevel: number;
  milestoneName: string;
  rewardLabel: string;
  rewardClaimed: boolean;
  claimedAt: string | null;
}

export function useAdminMilestoneAchievers() {
  return useQuery<MilestoneAchiever[]>({
    queryKey: ["admin-milestone-achievers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_milestone_achievers" as any,
      );
      if (error) throw error;
      if (!data || !Array.isArray(data)) return [];
      return (data as any[]).map((row) => ({
        userId: row.user_id,
        userCode: row.user_code,
        firstName: row.first_name,
        totalPts: Number(row.total_pts),
        milestoneId: row.milestone_id,
        milestoneLevel: row.milestone_level,
        milestoneName: row.milestone_name,
        rewardLabel: row.reward_label,
        rewardClaimed: row.reward_claimed,
        claimedAt: row.claimed_at,
      }));
    },
    staleTime: 60_000,
  });
}

export function useAdminClaimMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      milestoneId: string;
      notes?: string;
    }) => {
      const { error } = await supabase.rpc(
        "admin_claim_milestone_for_user" as any,
        {
          p_user_id: params.userId,
          p_milestone_id: params.milestoneId,
          p_notes: params.notes ?? null,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-milestone-achievers"] });
    },
  });
}

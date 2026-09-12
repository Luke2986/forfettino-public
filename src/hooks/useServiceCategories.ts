import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_CATEGORY_LIMIT } from "@/types/subscription";
import { getNextColor } from "@/lib/category-colors";
import type { Database } from "@/integrations/supabase/types";

type ServiceCategoryRow =
  Database["public"]["Tables"]["service_categories"]["Row"];

export type { ServiceCategoryRow };

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Il nome della categoria non può essere vuoto");
  if (trimmed.length > 50)
    throw new Error("Il nome della categoria non può superare i 50 caratteri");
  return trimmed;
}

function validateColor(color: string | undefined | null): void {
  if (color && !HEX_REGEX.test(color)) {
    throw new Error("Il colore deve essere in formato hex (es. #14b8a6)");
  }
}

export function useServiceCategories() {
  const { user } = useAuth();
  const { hasPaidPlan } = useSubscription();
  const queryClient = useQueryClient();

  const queryKey = ["service_categories", user?.id];

  // ---------- Fetch categories ----------
  const categoriesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ServiceCategoryRow[];
    },
    enabled: !!user,
  });

  const categories = categoriesQuery.data || [];
  const activeCategories = categories.filter((c) => c.active);
  const categoriesUsed = activeCategories.length;
  const canAddCategory = hasPaidPlan || categoriesUsed < FREE_CATEGORY_LIMIT;

  // ---------- Create category ----------
  const createCategoryMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      color?: string | null;
      icon?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (!canAddCategory) {
        throw new Error(
          `Hai raggiunto il limite di ${FREE_CATEGORY_LIMIT} categorie attive per il piano Free`
        );
      }

      const validName = validateName(params.name);
      validateColor(params.color);

      const usedColors = categories.map((c) => c.color).filter(Boolean) as string[];
      const color = params.color || getNextColor(usedColors);

      const { data, error } = await supabase
        .from("service_categories")
        .insert({
          user_id: user.id,
          name: validName,
          color,
          icon: params.icon || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ServiceCategoryRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ---------- Update category ----------
  const updateCategoryMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Pick<ServiceCategoryRow, "name" | "color" | "icon" | "sort_order">>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const updatePayload: Database["public"]["Tables"]["service_categories"]["Update"] = {
        updated_at: new Date().toISOString(),
      };

      if (params.updates.name !== undefined) {
        updatePayload.name = validateName(params.updates.name);
      }
      if (params.updates.color !== undefined) {
        validateColor(params.updates.color);
        updatePayload.color = params.updates.color;
      }
      if (params.updates.icon !== undefined) {
        updatePayload.icon = params.updates.icon;
      }
      if (params.updates.sort_order !== undefined) {
        updatePayload.sort_order = params.updates.sort_order;
      }

      const { data, error } = await supabase
        .from("service_categories")
        .update(updatePayload)
        .eq("id", params.id)
        .select()
        .single();
      if (error) throw error;
      return data as ServiceCategoryRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // ---------- Toggle active (soft delete) ----------
  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const category = categories.find((c) => c.id === id);
      if (!category) throw new Error("Categoria non trovata");

      const newActive = !category.active;

      // If reactivating, check Free limit
      if (newActive && !hasPaidPlan && categoriesUsed >= FREE_CATEGORY_LIMIT) {
        throw new Error(
          `Hai raggiunto il limite di ${FREE_CATEGORY_LIMIT} categorie attive per il piano Free`
        );
      }

      const { data, error } = await supabase
        .from("service_categories")
        .update({
          active: newActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ServiceCategoryRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    categories,
    activeCategories,
    categoriesUsed,
    canAddCategory,
    isLoading: categoriesQuery.isLoading,
    createCategory: createCategoryMutation.mutateAsync,
    updateCategory: updateCategoryMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    createCategoryMutation,
    updateCategoryMutation,
    toggleActiveMutation,
  };
}

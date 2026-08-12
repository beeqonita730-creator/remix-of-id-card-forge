import { useQuery } from "@tanstack/react-query";
import { listMyRoles, type AppRole } from "@/services/db";

export function useRoles() {
  const { data, isLoading } = useQuery({ queryKey: ["my-roles"], queryFn: listMyRoles });
  const roles = (data ?? []) as AppRole[];
  const has = (...r: AppRole[]) => r.some((x) => roles.includes(x));
  return {
    roles,
    loading: isLoading,
    isAdmin: has("admin"),
    /** issue, block, reissue, import */
    canManageCards: roles.length === 0 ? false : has("admin", "operator"),
    /** edit templates and designs */
    canDesign: has("admin", "designer"),
    /** print and export */
    canPrint: roles.length === 0 ? false : has("admin", "operator", "designer"),
  };
}

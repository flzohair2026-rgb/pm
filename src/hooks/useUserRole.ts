'use client';

import { useAuthContext, UserRole } from '@/hooks/useAuthContext';

export type { UserRole };

export function useUserRole() {
  const ctx = useAuthContext();
  return {
    role: ctx.role,
    loading: ctx.loading,
    error: ctx.error,
    isAdmin: ctx.isAdmin,
    isManager: ctx.isManager,
    isReceptionist: ctx.isReceptionist,
    isHousekeeping: ctx.isHousekeeping,
    isAccountant: ctx.isAccountant,
    isMarketing: ctx.isMarketing,
    user: ctx.user,
    refreshRole: ctx.refreshAuth,
  };
}

import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  findTenantAuthorization,
  hasBranchAccess,
} from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import type { AuthUser } from "@/features/auth/auth.types";
import { useWorkspaceBranchOptions } from "./workspace-branch-options";
import {
  canUseTenantWorkspaceHome,
  getDefaultWorkspaceSelection,
  isActiveBranchOption,
  isPreferenceOwnedByUser,
  isSelectionAccessible,
  type NavigationWorkspaceContext,
} from "./workspace-context";
import { useWorkspacePreferenceStore } from "./workspace-preference.store";

type NavigationWorkspaceResolution = {
  context: NavigationWorkspaceContext | null;
  invalidPreference: boolean;
  isResolvingPreference: boolean;
  shouldPersistRouteContext: boolean;
};

/**
 * Dựng context mặc định chỉ từ authorization snapshot; đây là fallback cuối
 * cùng sau route và preference đã được kiểm tra.
 */
function getDefaultNavigationContext(
  user: AuthUser | null,
): NavigationWorkspaceContext | null {
  const selection = getDefaultWorkspaceSelection(user);
  const tenant = selection
    ? findTenantAuthorization(user, { slug: selection.tenantSlug })
    : undefined;

  return tenant && selection
    ? { ...selection, source: "default", tenant }
    : null;
}

/**
 * Là điểm hợp nhất duy nhất cho workspace của thanh điều hướng.
 *
 * Thứ tự ưu tiên là route hiện tại, preference của đúng user còn hợp lệ, rồi
 * lựa chọn mặc định. Preference chỉ được ghi sau khi route đã được xác minh;
 * vì vậy localStorage không thể tự tạo tenant/branch context hay vượt quyền.
 */
export function useNavigationWorkspaceContext() {
  const { branchSlug: routeBranchSlug, tenantSlug: routeTenantSlug } = useParams();
  const user = useAuthStore((state) => state.user);
  const preference = useWorkspacePreferenceStore((state) => state.preference);
  const clearPreference = useWorkspacePreferenceStore(
    (state) => state.clearPreference,
  );
  const setPreference = useWorkspacePreferenceStore(
    (state) => state.setPreference,
  );
  const preferenceTenantSlug = isPreferenceOwnedByUser(preference, user)
    ? preference.tenantSlug
    : undefined;
  const candidateTenantSlug = routeTenantSlug ?? preferenceTenantSlug;
  const { branchOptions, isLoading: isLoadingBranchOptions } =
    useWorkspaceBranchOptions(user, candidateTenantSlug);

  const resolution = useMemo<NavigationWorkspaceResolution>(() => {
    if (routeTenantSlug) {
      const tenant = findTenantAuthorization(user, { slug: routeTenantSlug });
      if (!tenant) {
        return {
          context: null,
          invalidPreference: false,
          isResolvingPreference: false,
          shouldPersistRouteContext: false,
        };
      }

      if (!routeBranchSlug) {
        return {
          context: {
            branchSlug: null,
            source: "route" as const,
            tenant,
            tenantSlug: routeTenantSlug,
          },
          invalidPreference: false,
          isResolvingPreference: false,
          shouldPersistRouteContext: canUseTenantWorkspaceHome(
            user,
            routeTenantSlug,
          ),
        };
      }

      const hasAccess = hasBranchAccess(
        user,
        { slug: routeTenantSlug },
        routeBranchSlug,
      );
      const isKnownActiveBranch = isActiveBranchOption(
        branchOptions,
        routeBranchSlug,
      );
      const canValidateBranch = !isLoadingBranchOptions;

      if (!hasAccess || (canValidateBranch && !isKnownActiveBranch)) {
        return {
          context: null,
          invalidPreference: false,
          isResolvingPreference: false,
          shouldPersistRouteContext: false,
        };
      }

      return {
        context: {
          branchSlug: routeBranchSlug,
          source: "route" as const,
          tenant,
          tenantSlug: routeTenantSlug,
        },
        invalidPreference: false,
        isResolvingPreference: false,
        shouldPersistRouteContext: isKnownActiveBranch,
      };
    }

    if (isPreferenceOwnedByUser(preference, user)) {
      const selection = {
        branchSlug: preference.branchSlug,
        tenantSlug: preference.tenantSlug,
      };
      const tenant = findTenantAuthorization(user, {
        slug: selection.tenantSlug,
      });

      if (selection.branchSlug && isLoadingBranchOptions) {
        return {
          context: null,
          invalidPreference: false,
          isResolvingPreference: true,
          shouldPersistRouteContext: false,
        };
      }

      if (tenant && isSelectionAccessible(user, selection, branchOptions)) {
        return {
          context: {
            ...selection,
            source: "preference" as const,
            tenant,
          },
          invalidPreference: false,
          isResolvingPreference: false,
          shouldPersistRouteContext: false,
        };
      }

      return {
        context: getDefaultNavigationContext(user),
        invalidPreference: true,
        isResolvingPreference: false,
        shouldPersistRouteContext: false,
      };
    }

    return {
      context: getDefaultNavigationContext(user),
      invalidPreference: Boolean(preference),
      isResolvingPreference: false,
      shouldPersistRouteContext: false,
    };
  }, [
    branchOptions,
    isLoadingBranchOptions,
    preference,
    routeBranchSlug,
    routeTenantSlug,
    user,
  ]);

  useEffect(() => {
    if (resolution.invalidPreference) {
      clearPreference();
    }
  }, [clearPreference, resolution.invalidPreference]);

  useEffect(() => {
    if (
      !resolution.context ||
      !resolution.shouldPersistRouteContext ||
      !user
    ) {
      return;
    }

    setPreference({
      branchSlug: resolution.context.branchSlug,
      tenantSlug: resolution.context.tenantSlug,
      userId: user.id,
      version: 1,
    });
  }, [
    resolution.context,
    resolution.shouldPersistRouteContext,
    setPreference,
    user,
  ]);

  return {
    branchOptions,
    context: resolution.context,
    isLoadingBranchOptions,
    isResolvingPreference: resolution.isResolvingPreference,
  };
}

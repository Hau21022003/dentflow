import { hasPlatformPermission } from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import { PATHS } from "./paths";

type RedirectLocation = {
  hash?: unknown;
  pathname?: unknown;
  search?: unknown;
};

/** Thu hẹp router state không tin cậy thành object trước khi đọc trường redirect. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Chọn điểm vào sau xác thực: Platform Admin vào platform, các user tenant đi
 * qua /workspace để resolver quyết định tenant/branch hợp lệ cuối cùng.
 */
export function resolveDefaultAuthenticatedPath(
  user: AuthUser | null | undefined,
): string {
  if (hasPlatformPermission(user, PERMISSIONS.platformSystemRead)) {
    return PATHS.platform;
  }

  if (!user?.authorization.tenants.length) {
    return PATHS.forbidden;
  }

  return PATHS.workspace;
}

/**
 * Chỉ chấp nhận pathname nội bộ an toàn trong state `from`, rồi giữ nguyên
 * query/hash hợp lệ. Điều này tránh dùng state ngoài ứng dụng làm open redirect.
 */
export function resolvePostLoginPath(
  state: unknown,
  user: AuthUser | null | undefined,
): string {
  if (!isRecord(state) || !isRecord(state.from)) {
    return resolveDefaultAuthenticatedPath(user);
  }

  const from = state.from as RedirectLocation;
  const { pathname } = from;

  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname === PATHS.login
  ) {
    return resolveDefaultAuthenticatedPath(user);
  }

  const search =
    typeof from.search === "string" && from.search.startsWith("?")
      ? from.search
      : "";
  const hash =
    typeof from.hash === "string" && from.hash.startsWith("#")
      ? from.hash
      : "";

  return `${pathname}${search}${hash}`;
}

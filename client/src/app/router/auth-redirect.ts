import { PATHS } from "./paths";

type RedirectLocation = {
  hash?: unknown;
  pathname?: unknown;
  search?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolvePostLoginPath(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.from)) {
    return PATHS.patients;
  }

  const from = state.from as RedirectLocation;
  const { pathname } = from;

  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname === PATHS.login
  ) {
    return PATHS.patients;
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

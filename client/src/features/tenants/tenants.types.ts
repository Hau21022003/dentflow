export type TenantStatus =
  "PROVISIONING" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

export type PlatformTenantSortBy =
  "displayName" | "planName" | "branchCount" | "status" | "createdAt";

export type SortOrder = "ASC" | "DESC";

export type PlatformTenant = {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    plan: {
      id: string;
      code: string;
      name: string;
      billingInterval: string;
      amount: number;
      currency: string;
    };
  } | null;
  usage: {
    branchCount: number;
    userCount: number;
  };
};

export type PlatformTenantListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: TenantStatus;
  planId?: string;
  trialEndingBefore?: string;
  sortBy?: PlatformTenantSortBy;
  sortOrder?: SortOrder;
};

export type PlatformTenantPage = {
  items: PlatformTenant[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

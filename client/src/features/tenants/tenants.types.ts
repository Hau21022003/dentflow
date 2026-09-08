export type TenantStatus =
  | "PROVISIONING"
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELED";

export type PlatformTenantSortBy =
  | "displayName"
  | "planName"
  | "branchCount"
  | "status"
  | "createdAt";

export type SortOrder = "ASC" | "DESC";

export type TenantSubscription = {
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
};

export type TenantOwner =
  | {
      state: "ACCEPTED";
      userId: string;
      fullName: string;
      email: string;
    }
  | {
      state: "PENDING" | "EXPIRED";
      fullName: string;
      email: string;
      invitation: {
        id: string;
        expiresAt: string;
        deliveryStatus: "PENDING" | "SENT" | "FAILED";
        lastSentAt: string | null;
      };
    }
  | null;

export type PlatformTenant = {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  subscription: TenantSubscription | null;
  usage: {
    branchCount: number;
    userCount: number;
  };
  owner: TenantOwner;
};

export type PlatformTenantDetail = PlatformTenant & {
  billingEmail: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  defaultLocale: string;
  defaultTimezone: string;
  updatedAt: string;
  owner: TenantOwner;
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

export type CreatePlatformTenantInput = {
  legalName: string;
  displayName: string;
  slug: string;
  billingEmail: string;
  ownerEmail: string;
  ownerFullName: string;
  planId: string;
  trialDays?: number;
  defaultLocale?: string;
  defaultTimezone?: string;
};

export type UpdatePlatformTenantInput = {
  legalName?: string;
  displayName?: string;
  billingEmail?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  defaultLocale?: string;
  defaultTimezone?: string;
};

export type TenantReasonInput = { reason: string };
export type ExtendTenantTrialInput = TenantReasonInput & { days: number };

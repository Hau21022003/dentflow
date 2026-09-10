export type BranchStatus = "ACTIVE" | "INACTIVE";

export type BranchSortBy = "name" | "status" | "createdAt";

export type SortOrder = "ASC" | "DESC";

export type Branch = {
  id: string;
  slug: string;
  name: string;
  address: string;
  phone: string;
  timezone: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
};

export type BranchListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: BranchStatus;
  sortBy?: BranchSortBy;
  sortOrder?: SortOrder;
};

export type BranchPage = {
  items: Branch[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateBranchInput = {
  slug: string;
  name: string;
  address: string;
  phone: string;
  timezone?: string;
};

export type UpdateBranchInput = {
  name?: string;
  address?: string;
  phone?: string;
  timezone?: string | null;
};

export type BranchReasonInput = {
  reason: string;
};

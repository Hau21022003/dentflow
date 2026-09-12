export type ServiceGroup = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceGroupSortBy = "name" | "createdAt";
export type SortOrder = "ASC" | "DESC";

export type ServiceGroupListQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy?: ServiceGroupSortBy;
  sortOrder?: SortOrder;
};

export type ServiceGroupPage = {
  items: ServiceGroup[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type CreateServiceGroupInput = { name: string };
export type UpdateServiceGroupInput = { name?: string };
export type ServiceGroupReasonInput = { reason: string };

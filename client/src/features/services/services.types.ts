export type Service = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  amount: number;
  currency: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceSortBy =
  | "code"
  | "name"
  | "groupName"
  | "amount"
  | "durationMinutes"
  | "createdAt";

export type SortOrder = "ASC" | "DESC";

export type ServiceListQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy?: ServiceSortBy;
  sortOrder?: SortOrder;
};

export type ServicePage = {
  items: Service[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateServiceInput = {
  code: string;
  name: string;
  groupName: string;
  amount: number;
  currency: string;
  durationMinutes: number;
};

export type UpdateServiceInput = Partial<
  Omit<CreateServiceInput, "code">
> & {
  reason?: string;
};

export type ServiceReasonInput = {
  reason: string;
};

export const OPERATORY_TYPES = ["ROOM", "CHAIR"] as const;

export type OperatoryType = (typeof OPERATORY_TYPES)[number];
export type OperatorySortBy =
  "code" | "name" | "type" | "isActive" | "createdAt";

export type Operatory = {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  type: OperatoryType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OperatoryPage = {
  items: Operatory[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type OperatoryListQuery = {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy?: OperatorySortBy;
  sortOrder?: "ASC" | "DESC";
};

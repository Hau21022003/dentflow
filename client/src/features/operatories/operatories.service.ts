import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  Operatory,
  OperatoryListQuery,
  OperatoryPage,
  OperatoryType,
} from "./operatories.types";

type Scope = { tenantSlug: string; branchSlug: string };
type Command = Scope & IdempotentCommand;

function route({ tenantSlug, branchSlug }: Scope): string {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/operatories`;
}

export const operatoriesService = {
  async list(scope: Scope, query: OperatoryListQuery): Promise<OperatoryPage> {
    const { payload } = await http.get<OperatoryPage>(route(scope), {
      params: query,
    });
    return payload;
  },
  async create(
    command: Command & {
      input: { code: string; name: string; type: OperatoryType };
    },
  ): Promise<Operatory> {
    const { payload } = await http.post<Operatory>(
      route(command),
      command.input,
      { idempotencyKey: command.idempotencyKey },
    );
    return payload;
  },
  async update(
    command: Command & {
      operatoryId: string;
      input: { name: string; type: OperatoryType };
    },
  ): Promise<Operatory> {
    const { payload } = await http.patch<Operatory>(
      `${route(command)}/${encodeURIComponent(command.operatoryId)}`,
      command.input,
      { idempotencyKey: command.idempotencyKey },
    );
    return payload;
  },
  async changeActivity(
    command: Command & {
      operatoryId: string;
      active: boolean;
      reason: string;
    },
  ): Promise<Operatory> {
    const action = command.active ? "activate" : "deactivate";
    const { payload } = await http.post<Operatory>(
      `${route(command)}/${encodeURIComponent(command.operatoryId)}/${action}`,
      { reason: command.reason },
      { idempotencyKey: command.idempotencyKey },
    );
    return payload;
  },
};

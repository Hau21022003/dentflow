import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TenantRoleCode } from "@/features/auth/auth.types";
import type { Branch } from "@/features/branches/branches.types";
import type { StaffRoleSelection } from "@/features/staff/staff.types";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

const ROLE_CODES: TenantRoleCode[] = [
  "TENANT_ADMIN",
  "BRANCH_ADMIN",
  "RECEPTIONIST",
  "DENTIST",
];

type StaffRoleAssignmentsEditorProps = {
  assignments: StaffRoleSelection[];
  branches: Branch[];
  disabled?: boolean;
  error?: string | null;
  onChange: (assignments: StaffRoleSelection[]) => void;
};

export function StaffRoleAssignmentsEditor({
  assignments,
  branches,
  disabled = false,
  error,
  onChange,
}: StaffRoleAssignmentsEditorProps) {
  const { t } = useTranslation("staff");
  const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");
  const selectedRoles = new Set(assignments.map((assignment) => assignment.roleCode));
  const availableRole = ROLE_CODES.find((role) => !selectedRoles.has(role));

  function update(index: number, next: StaffRoleSelection) {
    onChange(assignments.map((assignment, current) => (current === index ? next : assignment)));
  }

  function setRole(index: number, roleCode: TenantRoleCode) {
    update(index, {
      roleCode,
      branchSlugs: roleCode === "TENANT_ADMIN" ? [] : assignments[index].branchSlugs,
    });
  }

  function toggleBranch(index: number, branchSlug: string, checked: boolean) {
    const current = assignments[index];
    const branchSlugs = checked
      ? [...current.branchSlugs, branchSlug]
      : current.branchSlugs.filter((slug) => slug !== branchSlug);
    update(index, { ...current, branchSlugs });
  }

  return (
    <fieldset className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{t("form.assignments")}</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("form.assignmentsHint")}
          </p>
        </div>
        <Button
          disabled={disabled || !availableRole}
          onClick={() => {
            if (!availableRole) return;
            onChange([...assignments, { roleCode: availableRole, branchSlugs: [] }]);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          {t("actions.addRole")}
        </Button>
      </div>

      {assignments.map((assignment, index) => {
        const isTenantAdmin = assignment.roleCode === "TENANT_ADMIN";
        const roleId = `staff-role-${index}`;

        return (
          <section className="rounded-xl border border-border/70 p-4" key={`${assignment.roleCode}-${index}`}>
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-2">
                <Label htmlFor={roleId}>{t("form.role")}</Label>
                <Select
                  disabled={disabled}
                  onValueChange={(value) => setRole(index, value as TenantRoleCode)}
                  value={assignment.roleCode}
                >
                  <SelectTrigger id={roleId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_CODES.map((roleCode) => (
                      <SelectItem
                        disabled={roleCode !== assignment.roleCode && selectedRoles.has(roleCode)}
                        key={roleCode}
                        value={roleCode}
                      >
                        {t(`roles.${roleCode}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                aria-label={t("actions.removeRole", { role: t(`roles.${assignment.roleCode}`) })}
                disabled={disabled || assignments.length === 1}
                onClick={() => onChange(assignments.filter((_, current) => current !== index))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Minus aria-hidden="true" />
              </Button>
            </div>

            {isTenantAdmin ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("form.tenantAdminScope")}
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                <Label>{t("form.branches")}</Label>
                {activeBranches.length === 0 ? (
                  <p className="text-sm text-destructive">{t("form.noActiveBranches")}</p>
                ) : (
                  <div className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                    {activeBranches.map((branch) => {
                      const inputId = `staff-role-${index}-branch-${branch.id}`;
                      return (
                        <Label className="w-fit cursor-pointer gap-2 text-sm font-normal" htmlFor={inputId} key={branch.id}>
                          <Checkbox
                            checked={assignment.branchSlugs.includes(branch.slug)}
                            disabled={disabled}
                            id={inputId}
                            onCheckedChange={(checked) => toggleBranch(index, branch.slug, checked === true)}
                          />
                          {branch.name}
                        </Label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FormDialog } from "@/components/form";
import { RHFTextField } from "@/components/form/RHFTextField";
import { Alert } from "@/components/ui/alert";
import type { Branch } from "@/features/branches/branches.types";
import {
  useCreateStaffInvitationMutation,
  useGrantStaffRolesMutation,
} from "@/features/staff/staff.hooks";
import type {
  StaffMemberItem,
  StaffRoleSelection,
} from "@/features/staff/staff.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { StaffRoleAssignmentsEditor } from "./StaffRoleAssignmentsEditor";

type FormValues = {
  email: string;
  fullName: string;
  reason: string;
};

type StaffRoleAssignmentDialogProps =
  | {
      branches: Branch[];
      mode: "invite";
      onOpenChange: (open: boolean) => void;
      onSuccess?: () => Promise<void> | void;
      open: boolean;
      tenantSlug: string;
    }
  | {
      branches: Branch[];
      member: StaffMemberItem;
      mode: "grant";
      onOpenChange: (open: boolean) => void;
      onSuccess?: () => Promise<void> | void;
      open: boolean;
      tenantSlug: string;
    };

const INITIAL_ASSIGNMENTS: StaffRoleSelection[] = [
  { roleCode: "RECEPTIONIST", branchSlugs: [] },
];

function normalizeAssignments(assignments: StaffRoleSelection[]) {
  return assignments.map((assignment) => ({
    roleCode: assignment.roleCode,
    branchSlugs:
      assignment.roleCode === "TENANT_ADMIN" ? [] : assignment.branchSlugs,
  }));
}

export function StaffRoleAssignmentDialog(props: StaffRoleAssignmentDialogProps) {
  const { branches, mode, onOpenChange, onSuccess, open, tenantSlug } = props;
  const { t } = useTranslation("staff");
  const { t: tValidation } = useTranslation("validation");
  const createInvitation = useCreateStaffInvitationMutation();
  const grantRoles = useGrantStaffRolesMutation();
  const [assignments, setAssignments] = useState<StaffRoleSelection[]>(INITIAL_ASSIGNMENTS);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentsTouched, setAssignmentsTouched] = useState(false);
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  const isInvite = mode === "invite";
  const mutation = isInvite ? createInvitation : grantRoles;
  const schema = useMemo(
    () =>
      z.object({
        email: isInvite
          ? z
              .string()
              .trim()
              .min(1, tValidation("required", { field: t("form.email") }))
              .email(tValidation("email", { field: t("form.email") }))
              .max(254, tValidation("maxLength", { field: t("form.email"), max: 254 }))
          : z.string(),
        fullName: isInvite
          ? z
              .string()
              .trim()
              .min(1, tValidation("required", { field: t("form.fullName") }))
              .max(150, tValidation("maxLength", { field: t("form.fullName"), max: 150 }))
          : z.string(),
        reason: z
          .string()
          .trim()
          .max(500, tValidation("maxLength", { field: t("form.reason"), max: 500 })),
      }),
    [isInvite, t, tValidation],
  );
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
  } = useForm<FormValues>({
    defaultValues: { email: "", fullName: "", reason: "" },
    resolver: zodResolver(schema),
  });

  function resetDialog() {
    reset({ email: "", fullName: "", reason: "" });
    setAssignments(INITIAL_ASSIGNMENTS);
    setAssignmentError(null);
    setAssignmentsTouched(false);
    setIntent(null);
  }

  function closeDialog() {
    resetDialog();
    onOpenChange(false);
  }

  function handleAssignmentsChange(next: StaffRoleSelection[]) {
    setAssignments(next);
    setAssignmentsTouched(true);
    setAssignmentError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !mutation.isPending) closeDialog();
  }

  async function submit(values: FormValues) {
    const normalizedAssignments = normalizeAssignments(assignments);
    const invalidBranchScope = normalizedAssignments.some(
      (assignment) =>
        assignment.roleCode !== "TENANT_ADMIN" && assignment.branchSlugs.length === 0,
    );
    if (normalizedAssignments.length === 0 || invalidBranchScope) {
      setAssignmentError(t("validation.assignmentScope"));
      return;
    }

    const reason = values.reason.trim();
    try {
      if (isInvite) {
        const input = {
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          ...(reason ? { reason } : {}),
          assignments: normalizedAssignments,
        };
        const nextIntent = idempotencyKeyForIntent(intent, {
          operation: "tenant.staff.invitation.create",
          tenantSlug,
          input,
        });
        setIntent(nextIntent);
        await createInvitation.mutateAsync({
          tenantSlug,
          input,
          idempotencyKey: nextIntent.key,
        });
      } else {
        const input = {
          ...(reason ? { reason } : {}),
          assignments: normalizedAssignments,
        };
        const nextIntent = idempotencyKeyForIntent(intent, {
          operation: "tenant.staff.role-grant",
          tenantSlug,
          userId: props.member.id,
          input,
        });
        setIntent(nextIntent);
        await grantRoles.mutateAsync({
          tenantSlug,
          userId: props.member.id,
          input,
          idempotencyKey: nextIntent.key,
        });
      }
      await onSuccess?.();
      closeDialog();
    } catch (error) {
      handleApiError<FormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-2xl"
      description={t(isInvite ? "invite.description" : "grant.description", isInvite ? undefined : { name: props.member.fullName })}
      isDirty={isDirty || assignmentsTouched}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(submit)}
      open={open}
      submitText={t(isInvite ? "actions.sendInvitation" : "actions.grantRoles")}
      title={t(isInvite ? "invite.title" : "grant.title")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && <Alert variant="destructive">{errors.root.server.message}</Alert>}
        {isInvite && (
          <div className="grid gap-5 sm:grid-cols-2">
            <RHFTextField
              autoComplete="email"
              control={control}
              disabled={mutation.isPending}
              fullWidth
              label={t("form.email")}
              maxLength={254}
              name="email"
              required
              type="email"
            />
            <RHFTextField
              autoComplete="name"
              control={control}
              disabled={mutation.isPending}
              fullWidth
              label={t("form.fullName")}
              maxLength={150}
              name="fullName"
              required
            />
          </div>
        )}
        <StaffRoleAssignmentsEditor
          assignments={assignments}
          branches={branches}
          disabled={mutation.isPending}
          error={assignmentError}
          onChange={handleAssignmentsChange}
        />
        <RHFTextField
          control={control}
          disabled={mutation.isPending}
          fullWidth
          helperText={t("form.reasonOptional")}
          label={t("form.reason")}
          maxLength={500}
          name="reason"
        />
      </div>
    </FormDialog>
  );
}

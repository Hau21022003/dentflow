import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FormDialog } from "@/components/form";
import { RHFTextField } from "@/components/form/RHFTextField";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  useCreateBranchStaffInvitationMutation,
  useGrantBranchStaffRolesMutation,
} from "@/features/staff/staff.hooks";
import type {
  BranchStaffRoleCode,
  StaffMemberItem,
} from "@/features/staff/staff.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";

type FormValues = {
  email: string;
  fullName: string;
  reason: string;
};

type BranchStaffRoleDialogProps =
  | {
      branchSlug: string;
      mode: "invite";
      onOpenChange: (open: boolean) => void;
      open: boolean;
      tenantSlug: string;
    }
  | {
      branchSlug: string;
      member: StaffMemberItem;
      mode: "grant";
      onOpenChange: (open: boolean) => void;
      open: boolean;
      tenantSlug: string;
    };

const ROLE_CODES: BranchStaffRoleCode[] = ["RECEPTIONIST", "DENTIST"];

export function BranchStaffRoleDialog(props: BranchStaffRoleDialogProps) {
  const { branchSlug, mode, onOpenChange, open, tenantSlug } = props;
  const { t } = useTranslation("staff");
  const { t: tValidation } = useTranslation("validation");
  const createInvitation = useCreateBranchStaffInvitationMutation();
  const grantRoles = useGrantBranchStaffRolesMutation();
  const isInvite = mode === "invite";
  const mutation = isInvite ? createInvitation : grantRoles;
  const [roleCodes, setRoleCodes] = useState<BranchStaffRoleCode[]>([
    "RECEPTIONIST",
  ]);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IdempotencyIntent | null>(null);
  const schema = z.object({
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
  });
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
    setRoleCodes(["RECEPTIONIST"]);
    setRoleError(null);
    setIntent(null);
  }

  function closeDialog() {
    resetDialog();
    onOpenChange(false);
  }

  function toggleRole(roleCode: BranchStaffRoleCode, checked: boolean) {
    setRoleCodes((current) => {
      const next = checked
        ? [...current, roleCode]
        : current.filter((candidate) => candidate !== roleCode);
      return ROLE_CODES.filter((candidate) => next.includes(candidate));
    });
    setRoleError(null);
  }

  async function submit(values: FormValues) {
    if (roleCodes.length === 0) {
      setRoleError(t("branch.validation.roleRequired"));
      return;
    }
    const reason = values.reason.trim();
    const input = {
      roleCodes,
      ...(reason ? { reason } : {}),
    };
    try {
      if (isInvite) {
        const invitationInput = {
          ...input,
          email: values.email.trim(),
          fullName: values.fullName.trim(),
        };
        const nextIntent = idempotencyKeyForIntent(intent, {
          operation: "branch.staff.invitation.create",
          tenantSlug,
          branchSlug,
          input: invitationInput,
        });
        setIntent(nextIntent);
        await createInvitation.mutateAsync({
          tenantSlug,
          branchSlug,
          input: invitationInput,
          idempotencyKey: nextIntent.key,
        });
      } else {
        const nextIntent = idempotencyKeyForIntent(intent, {
          operation: "branch.staff.role-grant",
          tenantSlug,
          branchSlug,
          userId: props.member.id,
          input,
        });
        setIntent(nextIntent);
        await grantRoles.mutateAsync({
          tenantSlug,
          branchSlug,
          userId: props.member.id,
          input,
          idempotencyKey: nextIntent.key,
        });
      }
      closeDialog();
    } catch (error) {
      handleApiError<FormValues>({ error, setError });
    }
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-xl"
      description={t(
        isInvite ? "branch.invite.description" : "branch.grant.description",
        isInvite ? undefined : { name: props.member.fullName },
      )}
      isDirty={isDirty}
      isSubmitting={mutation.isPending}
      noValidate
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !mutation.isPending) closeDialog();
      }}
      onSubmit={handleSubmit(submit)}
      open={open}
      submitText={t(isInvite ? "actions.sendInvitation" : "actions.grantRoles")}
      title={t(isInvite ? "branch.invite.title" : "branch.grant.title")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
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
        <fieldset className="grid gap-3">
          <legend className="font-medium">{t("branch.form.roles")}</legend>
          <p className="text-sm text-muted-foreground">
            {t("branch.form.rolesHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLE_CODES.map((roleCode) => {
              const id = `branch-staff-role-${roleCode}`;
              return (
                <Label
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                  htmlFor={id}
                  key={roleCode}
                >
                  <Checkbox
                    checked={roleCodes.includes(roleCode)}
                    disabled={mutation.isPending}
                    id={id}
                    onCheckedChange={(checked) =>
                      toggleRole(roleCode, checked === true)
                    }
                  />
                  {t(`roles.${roleCode}`)}
                </Label>
              );
            })}
          </div>
          {roleError && <p className="text-sm text-destructive">{roleError}</p>}
        </fieldset>
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

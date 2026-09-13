import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Languages, LoaderCircle, LogOut, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { PATHS, pathFor } from "@/app/router/paths";
import { RHFTextField } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authQueryKeys, useLogoutMutation } from "@/features/auth/auth.hooks";
import { authService } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { findTenantAuthorization } from "@/features/auth/authorization";
import { useAcceptStaffInvitationMutation } from "@/features/staff/staff.hooks";
import { handleApiError } from "@/shared/lib/error";

type StaffInvitationFormValues = { password: string };

export function AcceptStaffInvitationPage() {
  const { i18n, t } = useTranslation("staff");
  const { t: tCommon } = useTranslation("common");
  const { t: tValidation } = useTranslation("validation");
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const acceptMutation = useAcceptStaffInvitationMutation();
  const logoutMutation = useLogoutMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const token = searchParams.get("token")?.trim() ?? "";
  const isSignedIn = status === "authenticated";
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";
  const schema = useMemo(
    () =>
      z.object({
        password: isSignedIn
          ? z.string()
          : z
              .string()
              .min(12, tValidation("minLength", { field: t("accept.fields.password"), min: 12 }))
              .max(1024, tValidation("maxLength", { field: t("accept.fields.password"), max: 1024 })),
      }),
    [isSignedIn, t, tValidation],
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useForm<StaffInvitationFormValues>({
    defaultValues: { password: "" },
    resolver: zodResolver(schema),
  });

  function toggleLanguage() {
    void i18n.changeLanguage(language === "vi" ? "en" : "vi");
  }

  async function submit(values: StaffInvitationFormValues) {
    if (!token) return;

    try {
      const accepted = await acceptMutation.mutateAsync(
        isSignedIn ? { token } : { token, password: values.password },
      );
      if (!isSignedIn) {
        setSuccessMessage(t("accept.success.newUser"));
        navigate(PATHS.login, { replace: true });
        return;
      }

      const refreshedUser = await authService.getMe();
      queryClient.setQueryData(authQueryKeys.me(), refreshedUser);
      setAuthenticatedUser(refreshedUser);
      const invitedTenant = findTenantAuthorization(refreshedUser, {
        id: accepted.tenantId,
      });
      setSuccessMessage(t("accept.success.existingUser"));
      navigate(
        invitedTenant
          ? pathFor.workspace(invitedTenant.tenant.slug)
          : PATHS.root,
        { replace: true },
      );
    } catch (error) {
      handleApiError<StaffInvitationFormValues>({ error, setError });
    }
  }

  async function switchAccount() {
    try {
      await logoutMutation.mutateAsync();
      navigate(PATHS.login, {
        replace: true,
        state: {
          from: {
            pathname: PATHS.acceptStaffInvitation,
            search: location.search,
          },
        },
      });
    } catch (error) {
      setError("root.server", { type: "server", message: error instanceof Error ? error.message : t("errors.generic") });
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_oklch(0.91_0.065_185),_transparent_32%),radial-gradient(circle_at_bottom_right,_oklch(0.93_0.055_220),_transparent_36%)] px-4 py-10">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <Card className="relative w-full max-w-md border-white/80 shadow-xl shadow-primary/10">
        <CardHeader className="gap-4 pb-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Stethoscope aria-hidden="true" className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{t("accept.title")}</CardTitle>
            <CardDescription>{t("accept.description")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!token ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <span><strong>{t("accept.invalidTitle")}</strong><br />{t("accept.invalidDescription")}</span>
            </Alert>
          ) : status === "unknown" ? (
            <div className="flex justify-center py-8"><LoaderCircle aria-label={tCommon("auth.session.checking")} className="animate-spin" /></div>
          ) : (
            <form className="grid gap-5" noValidate onSubmit={handleSubmit(submit)}>
              {errors.root?.server?.message && (
                <Alert variant="destructive"><CircleAlert aria-hidden="true" /><span>{errors.root.server.message}</span></Alert>
              )}
              {successMessage && <Alert>{successMessage}</Alert>}
              {isSignedIn ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div>
                    <p className="font-semibold">{t("accept.signedInTitle")}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("accept.signedInDescription", { email: user?.email ?? "" })}</p>
                  </div>
                  <Button disabled={logoutMutation.isPending || acceptMutation.isPending} onClick={() => void switchAccount()} size="sm" type="button" variant="outline">
                    {logoutMutation.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <LogOut aria-hidden="true" />}
                    {t("accept.actions.switchAccount")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="font-semibold">{t("accept.newUserTitle")}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{t("accept.newUserDescription")}</p>
                  </div>
                  <RHFTextField
                    autoComplete="new-password"
                    control={control}
                    disabled={acceptMutation.isPending}
                    fullWidth
                    helperText={t("accept.passwordHint")}
                    label={t("accept.fields.password")}
                    maxLength={1024}
                    name="password"
                    required
                    type="password"
                  />
                </>
              )}
              <div className="flex items-center justify-between gap-3">
                <Button aria-label={language === "vi" ? tCommon("language.switchToEnglish") : tCommon("language.switchToVietnamese")} onClick={toggleLanguage} size="sm" type="button" variant="ghost">
                  <Languages aria-hidden="true" />{language === "vi" ? "EN" : "VI"}
                </Button>
                <Button disabled={acceptMutation.isPending || logoutMutation.isPending} type="submit">
                  {acceptMutation.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
                  {acceptMutation.isPending ? t("accept.actions.accepting") : t("accept.actions.accept")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

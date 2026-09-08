import { PATHS } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  formatSubscriptionPlanAmount,
  localeForLanguage,
} from "@/features/subscription-plans/subscription-plans.price";
import { TenantFormDialog } from "@/features/tenants/components/TenantFormDialog";
import {
  TenantLifecycleDialog,
  type TenantLifecycleAction,
} from "@/features/tenants/components/TenantLifecycleDialog";
import { TenantStatusBadge } from "@/features/tenants/components/TenantStatusBadge";
import { usePlatformTenantQuery } from "@/features/tenants/tenants.hooks";
import { getErrorMessage } from "@/shared/lib/error";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Mail,
  Pencil,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

function Value({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 break-words text-sm font-medium">{children}</p>;
}

export function TenantDetailPage() {
  const { tenantId = "" } = useParams();
  const { i18n, t } = useTranslation("tenants");
  const tenantQuery = usePlatformTenantQuery(tenantId);
  const [editOpen, setEditOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] =
    useState<TenantLifecycleAction | null>(null);
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const dateTimeFormatter = new Intl.DateTimeFormat(
    i18n.resolvedLanguage ?? "vi",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );

  if (tenantQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </div>
    );
  }

  if (tenantQuery.isError || !tenantQuery.data) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          {getErrorMessage(tenantQuery.error)}
        </Alert>
        <Button asChild variant="outline">
          <Link to={PATHS.platformTenants}>{t("actions.backToCatalog")}</Link>
        </Button>
      </div>
    );
  }

  const tenant = tenantQuery.data;
  const owner = tenant.owner;
  const canResend = owner?.state === "PENDING";
  const canExtend =
    (tenant.status === "TRIAL" || tenant.status === "PAST_DUE") &&
    (tenant.subscription?.status === "TRIAL" ||
      tenant.subscription?.status === "PAST_DUE");

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild size="sm" type="button" variant="ghost">
            <Link to={PATHS.platformTenants}>
              <ArrowLeft aria-hidden="true" />
              {t("actions.backToCatalog")}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {tenant.displayName}
            </h1>
            <TenantStatusBadge status={tenant.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {tenant.legalName} · {tenant.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setEditOpen(true)}
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" />
            {t("actions.edit")}
          </Button>
          {canResend && (
            <Button
              onClick={() => setLifecycleAction("resendInvite")}
              type="button"
              variant="outline"
            >
              <Mail aria-hidden="true" />
              {t("actions.resendInvite")}
            </Button>
          )}
          {canExtend && (
            <Button
              onClick={() => setLifecycleAction("extendTrial")}
              type="button"
              variant="outline"
            >
              <Clock3 aria-hidden="true" />
              {t("actions.extendTrial")}
            </Button>
          )}
          {tenant.status === "SUSPENDED" ? (
            <Button
              onClick={() => setLifecycleAction("reactivate")}
              type="button"
            >
              {t("actions.reactivate")}
            </Button>
          ) : (
            <Button
              onClick={() => setLifecycleAction("suspend")}
              type="button"
              variant="destructive"
            >
              {t("actions.suspend")}
            </Button>
          )}
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border/70">
            <CardTitle>{t("detail.profileTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.legalName")}
              </p>
              <Value>{tenant.legalName}</Value>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.billingEmail")}
              </p>
              <Value>{tenant.billingEmail}</Value>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.contactEmail")}
              </p>
              <Value>{tenant.contactEmail ?? t("detail.notSet")}</Value>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.contactPhone")}
              </p>
              <Value>{tenant.contactPhone ?? t("detail.notSet")}</Value>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.defaultLocale")}
              </p>
              <Value>{tenant.defaultLocale}</Value>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("fields.defaultTimezone")}
              </p>
              <Value>{tenant.defaultTimezone}</Value>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {t("fields.logoUrl")}
              </p>
              <Value>{tenant.logoUrl ?? t("detail.notSet")}</Value>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>{t("detail.usageTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-secondary p-2">
                <Building2 aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("detail.branches")}
                </p>
                <p className="text-2xl font-bold">{tenant.usage.branchCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-secondary p-2">
                <UsersRound aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("detail.users")}
                </p>
                <p className="text-2xl font-bold">{tenant.usage.userCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>{t("detail.subscriptionTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {tenant.subscription ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.plan")}
                  </p>
                  <Value>
                    {tenant.subscription.plan.name} ·{" "}
                    {tenant.subscription.plan.code}
                  </Value>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.price")}
                  </p>
                  <Value>
                    {formatSubscriptionPlanAmount(
                      tenant.subscription.plan.amount,
                      tenant.subscription.plan.currency,
                      locale,
                    )}
                  </Value>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.currentPeriod")}
                  </p>
                  <Value>
                    {tenant.subscription.currentPeriodEnd
                      ? dateTimeFormatter.format(
                          new Date(tenant.subscription.currentPeriodEnd),
                        )
                      : t("detail.notSet")}
                  </Value>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("detail.noSubscription")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>{t("detail.ownerTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {owner ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("detail.ownerState")}
                  </p>
                  <Value>{t(`ownerStates.${owner.state}`)}</Value>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("fields.ownerFullName")}
                  </p>
                  <Value>{owner.fullName}</Value>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("fields.ownerEmail")}
                  </p>
                  <Value>{owner.email}</Value>
                </div>
                {"invitation" in owner && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("detail.invitationDelivery")}
                    </p>
                    <Value>
                      {t(`deliveryStates.${owner.invitation.deliveryStatus}`)}
                    </Value>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("detail.noOwner")}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <TenantFormDialog
        onOpenChange={setEditOpen}
        open={editOpen}
        tenant={tenant}
      />
      {lifecycleAction && (
        <TenantLifecycleDialog
          action={lifecycleAction}
          onOpenChange={(open) => {
            if (!open) setLifecycleAction(null);
          }}
          tenant={tenant}
        />
      )}
    </div>
  );
}

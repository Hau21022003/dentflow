import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/features/auth/auth.hooks";
import { HTTP_STATUS } from "@/shared/constants/http-status.constants";
import { ApiError } from "@/shared/lib/error";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AuthSessionPending() {
  const { error, isFetching, refetch } = useMeQuery();
  const { t } = useTranslation("common");
  const apiError = error ? ApiError.from(error) : null;

  if (apiError && apiError.status !== HTTP_STATUS.UNAUTHORIZED) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm space-y-4">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <span>{t("auth.session.unavailable")}</span>
          </Alert>
          <Button
            className="w-full"
            disabled={isFetching}
            onClick={() => void refetch()}
            type="button"
          >
            {t("auth.session.retry")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main
      aria-live="polite"
      className="flex min-h-svh items-center justify-center bg-background px-4 py-10"
    >
      <div
        className="flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-primary"
        />
        {t("auth.session.checking")}
      </div>
    </main>
  );
}

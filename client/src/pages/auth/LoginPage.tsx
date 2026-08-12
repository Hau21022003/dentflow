import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  createValidationMessages,
  type Translate,
  type ValidationMessages,
} from "@/i18n/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleAlert,
  Languages,
  LoaderCircle,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { resolvePostLoginPath } from "../../app/router/auth-redirect";
import { useLoginMutation } from "../../features/auth/auth.hooks";
import { RHFTextField } from "../../shared/components/form";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants";
import { ApiError, handleApiError } from "../../shared/lib/error";

function createLoginSchema(tCommon: Translate, validation: ValidationMessages) {
  const email = tCommon("auth.fields.email");
  const password = tCommon("auth.fields.password");

  return z.object({
    email: z
      .string()
      .trim()
      .min(1, validation.required(email))
      .email(validation.email(email)),
    password: z.string().min(1, validation.required(password)),
  });
}

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;

export function LoginPage() {
  const { i18n, t: tCommon } = useTranslation("common");
  const { t: tValidation } = useTranslation("validation");
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";
  const validation = useMemo(
    () => createValidationMessages(tValidation),
    [tValidation],
  );
  const loginSchema = useMemo(
    () => createLoginSchema(tCommon, validation),
    [tCommon, validation],
  );
  const postLoginPath = useMemo(
    () => resolvePostLoginPath(location.state),
    [location.state],
  );
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  async function handleValidSubmit(credentials: LoginFormValues) {
    clearErrors("root.server");

    try {
      await loginMutation.mutateAsync(credentials);
      navigate(postLoginPath, { replace: true });
    } catch (error) {
      const apiError = ApiError.from(error);

      if (apiError.status === HTTP_STATUS.UNAUTHORIZED) {
        setError("root.server", {
          type: "server",
          message: tCommon("auth.errors.invalidCredentials"),
        });
        return;
      }

      handleApiError<LoginFormValues>({ error, setError });
    }
  }

  function toggleLanguage() {
    void i18n.changeLanguage(language === "vi" ? "en" : "vi");
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_oklch(0.91_0.065_185),_transparent_32%),radial-gradient(circle_at_bottom_right,_oklch(0.93_0.055_220),_transparent_36%)] px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-primary"
      />
      <Card className="relative w-full max-w-md border-white/80 shadow-xl shadow-primary/10">
        <CardHeader className="gap-4 pb-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Stethoscope aria-hidden="true" className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{tCommon("auth.title")}</CardTitle>
            <CardDescription>{tCommon("auth.description")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5"
            noValidate
            onSubmit={handleSubmit(handleValidSubmit)}
          >
            {errors.root?.server?.message && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <span>{errors.root.server.message}</span>
              </Alert>
            )}
            <RHFTextField
              autoComplete="email"
              control={control}
              disabled={loginMutation.isPending}
              fullWidth
              label={tCommon("auth.fields.email")}
              name="email"
              required
              type="email"
            />
            <RHFTextField
              autoComplete="current-password"
              control={control}
              disabled={loginMutation.isPending}
              fullWidth
              label={tCommon("auth.fields.password")}
              name="password"
              required
              type={showPassword ? "text" : "password"}
            />
            <div className="flex items-center justify-between gap-3">
              <Label
                className="w-fit cursor-pointer gap-2 text-muted-foreground"
                htmlFor="show-password"
              >
                <Checkbox
                  checked={showPassword}
                  disabled={loginMutation.isPending}
                  id="show-password"
                  onCheckedChange={(checked) =>
                    setShowPassword(checked === true)
                  }
                />
                {tCommon("auth.actions.showPassword")}
              </Label>
              <Button
                aria-label={
                  language === "vi"
                    ? tCommon("language.switchToEnglish")
                    : tCommon("language.switchToVietnamese")
                }
                onClick={toggleLanguage}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Languages aria-hidden="true" />
                {language === "vi" ? "EN" : "VI"}
              </Button>
            </div>
            <Button
              className="mt-1 h-11 w-full"
              disabled={loginMutation.isPending}
              type="submit"
            >
              {loginMutation.isPending && (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              )}
              {loginMutation.isPending
                ? tCommon("auth.actions.loggingIn")
                : tCommon("auth.actions.login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

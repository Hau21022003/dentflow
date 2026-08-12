import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, Stethoscope } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { PATHS } from "../../app/router/paths";
import { useLoginMutation } from "../../features/auth/auth.hooks";
import { RHFTextField } from "../../shared/components/form";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants";
import { ApiError, handleApiError } from "../../shared/lib/error";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
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
      navigate(PATHS.patients, { replace: true });
    } catch (error) {
      const apiError = ApiError.from(error);

      if (apiError.status === HTTP_STATUS.UNAUTHORIZED) {
        setError("root.server", {
          type: "server",
          message: "Email hoặc mật khẩu không đúng.",
        });
        return;
      }

      handleApiError<LoginFormValues>({ error, setError });
    }
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
            <CardTitle className="text-2xl">Chào mừng đến DentFlow</CardTitle>
            <CardDescription>
              Đăng nhập để tiếp tục sử dụng hệ thống quản lý nha khoa.
            </CardDescription>
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
              label="Email"
              name="email"
              required
              type="email"
            />
            <RHFTextField
              autoComplete="current-password"
              control={control}
              disabled={loginMutation.isPending}
              fullWidth
              label="Mật khẩu"
              name="password"
              required
              type="password"
            />
            <Button
              className="mt-1 h-11 w-full"
              disabled={loginMutation.isPending}
              type="submit"
            >
              {loginMutation.isPending && (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              )}
              {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

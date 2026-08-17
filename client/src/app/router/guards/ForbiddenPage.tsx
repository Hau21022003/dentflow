import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveDefaultAuthenticatedPath } from "@/app/router/auth-redirect";
import { useAuthStore } from "@/features/auth/auth.store";

export function ForbiddenPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto flex min-h-[55svh] max-w-xl items-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldX aria-hidden="true" className="size-7" />
          </span>
          <p className="mt-6 text-sm font-semibold text-destructive">403 · Không có quyền truy cập</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Trang này không thuộc phạm vi làm việc của bạn
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Quyền hiển thị được xác định từ platform, tenant và branch được gán cho tài khoản hiện tại.
          </p>
          <Button asChild className="mt-7">
            <Link to={resolveDefaultAuthenticatedPath(user)}>Về trang chủ phù hợp</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

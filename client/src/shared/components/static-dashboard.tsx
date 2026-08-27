import type { LucideIcon } from "lucide-react";
import { CircleDotDashed } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/shared/lib/utils";

export type StaticMetric = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: "primary" | "blue" | "amber" | "rose";
};

export type StaticListItem = {
  title: string;
  detail: string;
  status: string;
};

const toneClasses = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
} as const;

export function StaticPageHeader({
  eyebrow,
  title,
  description,
  context,
}: {
  eyebrow: string;
  title: string;
  description: string;
  context?: string;
}) {
  return (
    <>
      <Alert className="border-primary/20 bg-primary/5 text-foreground">
        <CircleDotDashed aria-hidden="true" />
        Đây là UI mẫu dùng dữ liệu synthetic; chưa có thao tác nghiệp vụ hoặc API ghi dữ liệu.
      </Alert>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
        {context && (
          <span className="w-fit rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
            {context}
          </span>
        )}
      </div>
    </>
  );
}

export function StaticMetricGrid({ metrics }: { metrics: StaticMetric[] }) {
  return (
    <section aria-label="Chỉ số tổng quan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ description, icon: Icon, label, tone = "primary", value }) => (
        <Card key={label}>
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function StaticListCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: StaticListItem[];
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="divide-y divide-border/70 p-0">
        {items.map((item) => (
          <div className="flex items-start gap-4 px-6 py-4" key={item.title}>
            <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
            </div>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {item.status}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

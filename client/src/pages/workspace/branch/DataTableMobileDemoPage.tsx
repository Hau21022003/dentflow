import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createDataTableLocale } from "@/i18n/data-table";

type DemoRecordStatus = "READY" | "REVIEW" | "PAUSED";

type DemoRecord = {
  id: string;
  reference: string;
  sequence: number;
  status: DemoRecordStatus;
  updatedAt: string;
};

const demoRecords: DemoRecord[] = Array.from({ length: 12 }, (_, index) => {
  const sequence = index + 1;
  const statuses: DemoRecordStatus[] = ["READY", "REVIEW", "PAUSED"];

  return {
    id: `demo-record-${sequence}`,
    reference: `DF-${String(sequence).padStart(3, "0")}`,
    sequence,
    status: statuses[index % statuses.length],
    updatedAt: `2026-09-${String(sequence).padStart(2, "0")}`,
  };
});

const statusVariants = {
  READY: "secondary",
  REVIEW: "outline",
  PAUSED: "destructive",
} as const;

/**
 * Temporary, unlinked screen for exercising DataTable's responsive item renderer.
 * Remove it after a production workflow owns the first mobile renderer.
 */
export function DataTableMobileDemoPage() {
  const { t } = useTranslation("dataTableDemo");
  const { t: tCommon } = useTranslation("common");
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clickedRecord, setClickedRecord] = useState<DemoRecord | null>(null);

  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );

  const columns = useMemo<ColumnDef<DemoRecord>[]>(
    () => [
      {
        accessorKey: "sequence",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.sequence")} />
        ),
        cell: ({ row }) => row.original.sequence,
      },
      {
        accessorKey: "reference",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.reference")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.reference}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => (
          <Badge variant={statusVariants[row.original.status]}>
            {t(`statuses.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.updatedAt")} />
        ),
        cell: ({ row }) => row.original.updatedAt,
      },
    ],
    [t],
  );

  return (
    <div className="max-w-5xl space-y-7">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {t("description")}
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground">
        <FlaskConical aria-hidden="true" />
        {t("temporaryNotice")}
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button
          aria-pressed={isLoading}
          onClick={() => setIsLoading((current) => !current)}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("controls.toggleLoading")}
        </Button>
        <Button
          aria-pressed={isFetching}
          onClick={() => setIsFetching((current) => !current)}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("controls.toggleFetching")}
        </Button>
      </div>

      <div
        aria-live="polite"
        className="space-y-1 text-sm text-muted-foreground"
      >
        <p data-testid="data-table-demo-last-clicked">
          {clickedRecord
            ? t("lastClicked", { reference: clickedRecord.reference })
            : t("noRecordClicked")}
        </p>
      </div>

      <section className="space-y-4" data-testid="data-table-demo-divided">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("layouts.divided.title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("layouts.divided.description")}
          </p>
        </div>
        <DataTable
          columns={columns}
          data={demoRecords}
          isFetching={isFetching}
          isLoading={isLoading}
          locale={dataTableLocale}
          onRowClick={setClickedRecord}
          pagination={{ pageSize: 5, pageSizeOptions: [5, 10] }}
          renderMobileItem={(item, index) => (
            <div
              data-index={index}
              data-testid={`data-table-demo-divided-item-${item.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.reference}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("card.visiblePosition", { index: index + 1 })}
                  </p>
                </div>
                <Badge variant={statusVariants[item.status]}>
                  {t(`statuses.${item.status}`)}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span>{t("card.sequence", { sequence: item.sequence })}</span>
                <span className="text-muted-foreground">
                  {t("card.updatedAt", { date: item.updatedAt })}
                </span>
              </div>
            </div>
          )}
          toolbar={{ viewOptions: true }}
        />
      </section>

      <section className="space-y-4" data-testid="data-table-demo-cards">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("layouts.cards.title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("layouts.cards.description")}
          </p>
        </div>
        <DataTable
          columns={columns}
          data={demoRecords}
          isFetching={isFetching}
          isLoading={isLoading}
          locale={dataTableLocale}
          mobileLayout="cards"
          onRowClick={setClickedRecord}
          pagination={{ pageSize: 5, pageSizeOptions: [5, 10] }}
          renderMobileItem={(item, index) => (
            <Card
              data-index={index}
              data-testid={`data-table-demo-card-item-${item.id}`}
            >
              <CardHeader className="gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{item.reference}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("card.visiblePosition", { index: index + 1 })}
                    </p>
                  </div>
                  <Badge variant={statusVariants[item.status]}>
                    {t(`statuses.${item.status}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 p-4 pt-0 text-sm">
                <span>{t("card.sequence", { sequence: item.sequence })}</span>
                <span className="text-muted-foreground">
                  {t("card.updatedAt", { date: item.updatedAt })}
                </span>
              </CardContent>
            </Card>
          )}
          toolbar={{ viewOptions: true }}
        />
      </section>
    </div>
  );
}

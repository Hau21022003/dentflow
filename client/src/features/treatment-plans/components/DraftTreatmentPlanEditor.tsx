import { RHFCombobox, RHFTextField, RHFTextarea } from "@/components/form";
import { DataTable } from "@/components/shadcntable/data-table";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  useAppointmentDentistsQuery,
  useAppointmentServicesQuery,
} from "@/features/appointments/appointments.hooks";
import type { AppointmentServiceOption } from "@/features/appointments/appointments.types";
import {
  useProposeTreatmentPlanMutation,
  useSyncTreatmentPlanMutation,
} from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import type {
  SyncTreatmentPlanItemInput,
  TreatmentPlan,
  TreatmentPlanItem,
} from "@/features/treatment-plans/treatment-plans.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Calculator,
  Check,
  EllipsisVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { toast } from "sonner";
import {
  TreatmentPlanOdontogram,
  type Dentition,
} from "./TreatmentPlanOdontogram";
import {
  formatFdiPosition,
  parseFdiPosition,
} from "./treatment-plan-odontogram";

type ComposerForm = Omit<SyncTreatmentPlanItemInput, "id">;

type ServiceSnapshot = Pick<
  AppointmentServiceOption,
  "id" | "code" | "name" | "amount" | "currency"
>;

type StagedTreatmentItem = SyncTreatmentPlanItemInput & {
  editorKey: string;
  service: ServiceSnapshot;
};

const EMPTY_COMPOSER: ComposerForm = {
  serviceId: "",
  quantity: 1,
  discountAmount: 0,
  plannedDentistUserId: "",
  toothPosition: null,
  indication: null,
};

function itemFromPlan(item: TreatmentPlanItem): StagedTreatmentItem {
  return {
    editorKey: item.id,
    id: item.id,
    serviceId: item.serviceId,
    quantity: item.quantity,
    discountAmount: item.discountAmount,
    plannedDentistUserId: item.plannedDentistUserId,
    toothPosition: item.toothPosition,
    indication: item.indication,
    service: {
      id: item.serviceId,
      code: item.serviceCode,
      name: item.serviceName,
      amount: item.listUnitAmount,
      currency: item.currency,
    },
  };
}

function apiItem(item: StagedTreatmentItem): SyncTreatmentPlanItemInput {
  return {
    ...(item.id ? { id: item.id } : {}),
    serviceId: item.serviceId,
    quantity: Number(item.quantity),
    discountAmount: Number(item.discountAmount),
    plannedDentistUserId: item.plannedDentistUserId,
    toothPosition: item.toothPosition?.trim() || null,
    indication: item.indication?.trim() || null,
  };
}

function itemsSignature(items: StagedTreatmentItem[]): string {
  return JSON.stringify(items.map(apiItem));
}

function newEditorKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function DiscountAmountField({
  control,
  currency,
  maximum,
}: {
  control: Control<ComposerForm>;
  currency: string | undefined;
  maximum: number | undefined;
}) {
  const { t } = useTranslation("treatmentPlans");
  const inputId = useId();
  const messageId = `${inputId}-message`;

  return (
    <Controller
      control={control}
      name="discountAmount"
      rules={{
        required: t("validation.required"),
        min: { value: 0, message: t("validation.discount") },
        validate: (value) => {
          if (!Number.isInteger(Number(value))) return t("validation.wholeAmount");
          if (maximum !== undefined && Number(value) > maximum) {
            return t("validation.discountExceeds");
          }
          return true;
        },
      }}
      render={({ field, fieldState }) => (
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={inputId}>
            {t("fields.discountAmount")}
            <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <InputGroup className="h-10">
            <InputGroupInput
              {...field}
              aria-describedby={fieldState.error ? messageId : undefined}
              aria-invalid={Boolean(fieldState.error)}
              id={inputId}
              min={0}
              onChange={(event) =>
                field.onChange(
                  event.currentTarget.value === ""
                    ? ""
                    : event.currentTarget.valueAsNumber,
                )
              }
              required
              type="number"
              value={field.value ?? ""}
            />
            <InputGroupAddon align="inline-end">
              {currency ?? "—"}
            </InputGroupAddon>
          </InputGroup>
          {fieldState.error && (
            <p className="text-xs text-destructive" id={messageId}>
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}

function ItemCost({
  item,
  locale,
}: {
  item: StagedTreatmentItem;
  locale: string;
}) {
  const total =
    Math.max(0, item.service.amount - item.discountAmount) * item.quantity;
  return <>{formatMinorAmount(total, item.service.currency, locale)}</>;
}

export function DraftTreatmentPlanEditor({
  onCancel,
  onCancelPlan,
  onProposed,
  plan,
  showMobileTitle = false,
  scope,
}: {
  onCancel?: () => void;
  onCancelPlan?: () => void;
  onProposed?: () => void;
  plan: TreatmentPlan;
  showMobileTitle?: boolean;
  scope: TreatmentPlanScope;
}) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const { t: tCommon } = useTranslation("common");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const initialItems = plan.items.map(itemFromPlan);
  const [stagedItems, setStagedItems] = useState<StagedTreatmentItem[]>(initialItems);
  const [savedSignature, setSavedSignature] = useState(() =>
    itemsSignature(initialItems),
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [quantityManuallyEdited, setQuantityManuallyEdited] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [dentistSearch, setDentistSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const composerCardRef = useRef<HTMLDivElement | null>(null);
  const allowNavigationRef = useRef(false);
  const syncIntentRef = useRef<IdempotencyIntent | null>(null);
  const proposeIntentRef = useRef<IdempotencyIntent | null>(null);
  const form = useForm<ComposerForm>({ defaultValues: EMPTY_COMPOSER });
  const syncMutation = useSyncTreatmentPlanMutation();
  const proposeMutation = useProposeTreatmentPlanMutation();
  const services = useAppointmentServicesQuery(scope.tenantSlug, scope.branchSlug, {
    page: 1,
    limit: 100,
    search: serviceSearch || undefined,
  });
  const dentists = useAppointmentDentistsQuery(scope.tenantSlug, scope.branchSlug, {
    page: 1,
    limit: 100,
    search: dentistSearch || undefined,
  });
  const serviceId = useWatch({ control: form.control, name: "serviceId" });
  const toothPosition = useWatch({ control: form.control, name: "toothPosition" });
  const parsedPosition = useMemo(
    () => parseFdiPosition(toothPosition),
    [toothPosition],
  );

  const serviceCache = useMemo<Record<string, ServiceSnapshot>>(
    () =>
      Object.fromEntries([
        ...stagedItems.map((item) => [item.service.id, item.service] as const),
        ...(services.data?.items ?? []).map((service) => [
          service.id,
          {
            id: service.id,
            code: service.code,
            name: service.name,
            amount: service.amount,
            currency: service.currency,
          },
        ] as const),
      ]),
    [services.data?.items, stagedItems],
  );
  const dentistNames = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        (dentists.data?.items ?? []).map((dentist) => [
          dentist.id,
          dentist.fullName,
        ]),
      ),
    [dentists.data?.items],
  );

  const serviceOptions = useMemo(
    () =>
      (services.data?.items ?? []).map((service) => ({
        value: service.id,
        label: `${service.code} · ${service.name} · ${formatMinorAmount(service.amount, service.currency, locale)}`,
      })),
    [locale, services.data?.items],
  );
  const dentistOptions = useMemo(
    () =>
      (dentists.data?.items ?? []).map((dentist) => ({
        value: dentist.id,
        label: dentist.fullName,
      })),
    [dentists.data?.items],
  );
  const selectedService = serviceId ? serviceCache[serviceId] : undefined;
  const stagedDirty = itemsSignature(stagedItems) !== savedSignature;
  const composerActive = editingKey !== null || form.formState.isDirty;
  const editorDirty = stagedDirty || composerActive;
  const blocker = useBlocker(() => editorDirty && !allowNavigationRef.current);
  const isPending = syncMutation.isPending || proposeMutation.isPending;

  useBeforeUnload(
    (event) => {
      if (!editorDirty) return;
      event.preventDefault();
      event.returnValue = "";
    },
    { capture: true },
  );

  function resetComposer() {
    form.reset(EMPTY_COMPOSER);
    form.clearErrors();
    setEditingKey(null);
    setQuantityManuallyEdited(false);
    setDentition("permanent");
  }

  function setSelectedTeeth(codes: string[]) {
    form.setValue("toothPosition", formatFdiPosition(codes) || null, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (!quantityManuallyEdited) {
      form.setValue("quantity", Math.max(1, codes.length), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    form.clearErrors("root.uncommitted");
  }

  function toggleTooth(code: string) {
    const next = new Set(parsedPosition.codes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedTeeth(Array.from(next));
  }

  function commitComposer(values: ComposerForm) {
    const service = serviceCache[values.serviceId];
    if (!service) {
      form.setError("serviceId", {
        type: "validate",
        message: t("validation.activeService"),
      });
      return;
    }

    const existing = editingKey
      ? stagedItems.find((item) => item.editorKey === editingKey)
      : undefined;
    const next: StagedTreatmentItem = {
      editorKey: existing?.editorKey ?? newEditorKey(),
      ...(existing?.id ? { id: existing.id } : {}),
      serviceId: values.serviceId,
      quantity: Number(values.quantity),
      discountAmount: Number(values.discountAmount),
      plannedDentistUserId: values.plannedDentistUserId,
      toothPosition: values.toothPosition?.trim() || null,
      indication: values.indication?.trim() || null,
      service,
    };

    setStagedItems((current) =>
      existing
        ? current.map((item) => (item.editorKey === existing.editorKey ? next : item))
        : [...current, next],
    );
    setActionError("");
    resetComposer();
  }

  function editItem(item: StagedTreatmentItem) {
    setEditingKey(item.editorKey);
    setQuantityManuallyEdited(true);
    const parsed = parseFdiPosition(item.toothPosition);
    if (parsed.codes.some((code) => Number(code[0]) >= 5)) setDentition("primary");
    else setDentition("permanent");
    form.reset({
      serviceId: item.serviceId,
      quantity: item.quantity,
      discountAmount: item.discountAmount,
      plannedDentistUserId: item.plannedDentistUserId,
      toothPosition: item.toothPosition,
      indication: item.indication,
    });
    window.requestAnimationFrame(() =>
      composerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function removeItem(editorKey: string) {
    setStagedItems((current) =>
      current.filter((item) => item.editorKey !== editorKey),
    );
    if (editingKey === editorKey) resetComposer();
  }

  function requireCommittedComposer(): boolean {
    if (!composerActive) return true;
    form.setError("root.uncommitted", {
      type: "manual",
      message: t("editor.pendingComposer"),
    });
    composerCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  async function syncItems(): Promise<TreatmentPlan> {
    const items = stagedItems.map(apiItem);
    const command = {
      operation: "clinical.treatment-plan.draft-sync",
      ...scope,
      planId: plan.id,
      items,
    };
    const intent = idempotencyKeyForIntent(syncIntentRef.current, command);
    syncIntentRef.current = intent;
    const synced = await syncMutation.mutateAsync({
      ...scope,
      planId: plan.id,
      input: { items },
      idempotencyKey: intent.key,
    });
    syncIntentRef.current = null;
    const syncedItems = synced.items.map(itemFromPlan);
    setStagedItems(syncedItems);
    setSavedSignature(itemsSignature(syncedItems));
    return synced;
  }

  async function saveDraft() {
    if (!requireCommittedComposer()) return;
    setActionError("");
    try {
      await syncItems();
      toast.success(t("feedback.draftSaved"), { position: "top-right" });
    } catch (error) {
      handleApiError({ error, onMessage: setActionError });
    }
  }

  async function createTreatmentPlan() {
    if (!requireCommittedComposer()) return;
    if (stagedItems.length === 0) {
      setActionError(t("editor.needItem"));
      return;
    }

    setActionError("");
    try {
      if (stagedDirty) await syncItems();
      const command = {
        operation: "clinical.treatment-plan.propose",
        ...scope,
        planId: plan.id,
      };
      const intent = idempotencyKeyForIntent(proposeIntentRef.current, command);
      proposeIntentRef.current = intent;
      await proposeMutation.mutateAsync({
        ...scope,
        planId: plan.id,
        idempotencyKey: intent.key,
      });
      proposeIntentRef.current = null;
      allowNavigationRef.current = true;
      toast.success(t("feedback.proposed"), { position: "top-right" });
      onProposed?.();
    } catch (error) {
      handleApiError({ error, onMessage: setActionError });
    }
  }

  const totals = useMemo(() => {
    const amounts = new Map<string, number>();
    for (const item of stagedItems) {
      const amount =
        Math.max(0, item.service.amount - item.discountAmount) * item.quantity;
      amounts.set(item.service.currency, (amounts.get(item.service.currency) ?? 0) + amount);
    }
    return Array.from(amounts.entries());
  }, [stagedItems]);
  const uniqueToothCount = useMemo(
    () =>
      new Set(
        stagedItems.flatMap((item) => parseFdiPosition(item.toothPosition).codes),
      ).size,
    [stagedItems],
  );
  const dataTableLocale = useMemo(
    () => createDataTableLocale(tCommon),
    [tCommon],
  );
  const columns: ColumnDef<StagedTreatmentItem>[] = [
    {
      id: "index",
      header: () => <span className="block w-6">#</span>,
      cell: ({ row }) => <span className="block w-6">{row.index + 1}</span>,
    },
    {
      id: "service",
      header: () => t("editor.columns.service"),
      cell: ({ row }) => (
        <div className="min-w-32 max-w-56 whitespace-normal break-words py-0.5">
          <p className="font-medium leading-5">{row.original.service.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("detail.quantity", { count: row.original.quantity })}
          </p>
        </div>
      ),
    },
    {
      id: "teeth",
      header: () => t("editor.columns.teeth"),
      cell: ({ row }) => (
        <p className="min-w-16 max-w-28 whitespace-normal break-words">
          {row.original.toothPosition || "—"}
        </p>
      ),
    },
    {
      id: "dentist",
      header: () => t("editor.columns.dentist"),
      cell: ({ row }) => (
        <p className="min-w-32 max-w-44 whitespace-normal break-words">
          {dentistNames[row.original.plannedDentistUserId] ??
            t("editor.dentistUnavailable")}
        </p>
      ),
    },
    {
      id: "cost",
      header: () => (
        <span className="block min-w-28 text-right">
          {t("editor.columns.cost")}
        </span>
      ),
      cell: ({ row }) => (
        <div className="min-w-28 whitespace-nowrap text-right font-semibold">
          <ItemCost item={row.original} locale={locale} />
        </div>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      header: () => (
        <span className="block w-16 text-right">
          {t("editor.columns.actions")}
        </span>
      ),
      cell: ({ row }) => {
        const itemNumber = row.index + 1;
        return (
          <div className="flex w-16 flex-nowrap justify-end gap-1">
            <Button
              aria-label={t("actions.editItem", { count: itemNumber })}
              onClick={() => editItem(row.original)}
              size="icon-sm"
              title={t("actions.editItem", { count: itemNumber })}
              type="button"
              variant="outline"
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              aria-label={t("actions.deleteItem", { count: itemNumber })}
              onClick={() => removeItem(row.original.editorKey)}
              size="icon-sm"
              title={t("actions.deleteItem", { count: itemNumber })}
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        {showMobileTitle && (
          <h1 className="min-w-0 text-xl font-bold tracking-tight">
            {t("detail.title")}
          </h1>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="outline">{t("statuses.plan.DRAFT")}</Badge>
          {onCancelPlan && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("actions.more")}
                  disabled={isPending}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <EllipsisVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={onCancelPlan}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  {t("actions.cancelPlan")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {actionError && <Alert variant="destructive">{actionError}</Alert>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <TreatmentPlanOdontogram
          dentition={dentition}
          onClear={() => setSelectedTeeth([])}
          onDentitionChange={setDentition}
          onToggle={toggleTooth}
          selectedCodes={parsedPosition.codes}
        />

        <div className="space-y-4">
          <Card ref={composerCardRef}>
            <CardHeader className="flex-row items-start justify-between gap-3 border-b p-3 sm:p-5">
              <div>
                <CardTitle>
                  {editingKey ? t("editor.editTitle") : t("editor.title")}
                </CardTitle>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  {t("editor.description")}
                </p>
              </div>
              <Badge className="hidden sm:inline-flex" variant="outline">
                {t("statuses.plan.DRAFT")}
              </Badge>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(commitComposer)}
              >
                {form.formState.errors.root?.uncommitted && (
                  <Alert variant="destructive">
                    {form.formState.errors.root.uncommitted.message}
                  </Alert>
                )}
                <div className="grid gap-4">
                  <div className="min-w-0">
                    <RHFCombobox
                      className="min-w-0"
                      control={form.control}
                      emptyMessage={t("picker.emptyServices")}
                      fullWidth
                      label={t("fields.service")}
                      name="serviceId"
                      onSearchChange={setServiceSearch}
                      options={serviceOptions}
                      placeholder={t("picker.servicePlaceholder")}
                      required
                      rules={{ required: t("validation.required") }}
                      searchPlaceholder={t("picker.serviceSearch")}
                      selectedLabel={
                        selectedService
                          ? `${selectedService.code} · ${selectedService.name} · ${formatMinorAmount(selectedService.amount, selectedService.currency, locale)}`
                          : undefined
                      }
                    />
                  </div>

                  <div className="grid gap-4 min-[380px]:grid-cols-[repeat(2,minmax(0,1fr))]">
                    <div className="min-w-0">
                      <RHFTextField
                        control={form.control}
                        helperText={t("editor.toothPositionHelper")}
                        label={t("fields.toothPosition")}
                        maxLength={100}
                        name="toothPosition"
                      />
                    </div>
                    <div className="min-w-0">
                      <RHFTextField
                        control={form.control}
                        label={t("fields.quantity")}
                        max={10000}
                        min={1}
                        name="quantity"
                        onInput={() => setQuantityManuallyEdited(true)}
                        required
                        rules={{
                          required: t("validation.required"),
                          min: { value: 1, message: t("validation.quantity") },
                          max: { value: 10000, message: t("validation.quantity") },
                          valueAsNumber: true,
                        }}
                        type="number"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 min-[380px]:grid-cols-[repeat(2,minmax(0,1fr))]">
                    <div className="min-w-0">
                      <RHFCombobox
                        className="min-w-0"
                        control={form.control}
                        emptyMessage={t("picker.emptyDentists")}
                        fullWidth
                        label={t("fields.plannedDentist")}
                        name="plannedDentistUserId"
                        onSearchChange={setDentistSearch}
                        options={dentistOptions}
                        placeholder={t("picker.dentistPlaceholder")}
                        required
                        rules={{ required: t("validation.required") }}
                        searchPlaceholder={t("picker.dentistSearch")}
                        selectedLabel={
                          dentistNames[form.getValues("plannedDentistUserId")]
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <DiscountAmountField
                        control={form.control}
                        currency={selectedService?.currency}
                        maximum={selectedService?.amount}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <RHFTextarea
                      className="min-h-20 max-h-32 resize-y sm:min-h-24"
                      control={form.control}
                      fullWidth
                      label={t("fields.indication")}
                      maxLength={10000}
                      name="indication"
                      placeholder={t("editor.indicationPlaceholder")}
                    />
                  </div>
                </div>

                {parsedPosition.hasLegacyText && (
                  <Alert>
                    <AlertTriangle aria-hidden="true" />
                    {t("editor.legacyToothWarning")}
                  </Alert>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button className="w-full sm:w-auto" type="submit">
                    {editingKey ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    {editingKey
                      ? t("actions.updateItem")
                      : t("actions.addToPlan")}
                  </Button>
                  {editingKey && (
                    <Button onClick={resetComposer} type="button" variant="outline">
                      <X aria-hidden="true" />
                      {t("actions.cancelEdit")}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-3 p-3 pb-2 sm:px-5 sm:pt-5 sm:pb-3">
              <div className="min-w-0">
                <CardTitle>
                  {t("editor.itemsTitle", { count: stagedItems.length })}
                </CardTitle>
                <p className="mt-1 hidden text-sm leading-5 text-muted-foreground sm:block">
                  {t("editor.itemsDescription")}
                </p>
              </div>
              {stagedItems.length > 0 && (
                <Button
                  onClick={() => setClearAllOpen(true)}
                  className="shrink-0"
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  {t("actions.clearAll")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0 sm:px-5 sm:pb-5">
              <DataTable
                columns={columns}
                data={stagedItems}
                emptyState={
                  <div className="grid place-items-center gap-2 px-5 py-10 text-center">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Plus aria-hidden="true" className="size-5" />
                    </span>
                    <p className="font-medium">{t("editor.noItems")}</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {t("editor.noItemsDescription")}
                    </p>
                  </div>
                }
                locale={dataTableLocale}
                mobileLayout="cards"
                pagination={{ enabled: false }}
                renderMobileItem={(item, index) => (
                  <article className="space-y-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-5">
                          {index + 1}. {item.service.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("detail.quantity", { count: item.quantity })}
                        </p>
                      </div>
                      <p className="shrink-0 whitespace-nowrap text-sm font-semibold text-primary">
                        <ItemCost item={item} locale={locale} />
                      </p>
                    </div>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">
                        {t("editor.columns.teeth")}
                      </dt>
                      <dd className="break-words">{item.toothPosition || "—"}</dd>
                      <dt className="text-muted-foreground">
                        {t("editor.columns.dentist")}
                      </dt>
                      <dd className="break-words">
                        {dentistNames[item.plannedDentistUserId] ??
                          t("editor.dentistUnavailable")}
                      </dd>
                    </dl>
                    <div className="flex flex-nowrap gap-2">
                      <Button
                        aria-label={t("actions.editItem", { count: index + 1 })}
                        onClick={() => editItem(item)}
                        size="icon-sm"
                        title={t("actions.editItem", { count: index + 1 })}
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label={t("actions.deleteItem", { count: index + 1 })}
                        onClick={() => removeItem(item.editorKey)}
                        size="icon-sm"
                        title={t("actions.deleteItem", { count: index + 1 })}
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </article>
                )}
                toolbar={{ search: false, viewOptions: false }}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Calculator aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("editor.estimatedTotal")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("itemCount", { count: stagedItems.length })} ·{" "}
                      {t("toothCount", { count: uniqueToothCount })}
                    </p>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  {totals.length === 0 ? (
                    <p className="text-lg font-bold text-primary">
                      —
                    </p>
                  ) : (
                    totals.map(([currency, amount]) => (
                      <p
                        className="whitespace-nowrap text-lg font-bold text-primary"
                        key={currency}
                      >
                        {formatMinorAmount(amount, currency, locale)}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className="sticky bottom-0 z-20 -mx-1 flex items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur sm:justify-between sm:p-3"
        data-slot="treatment-plan-actions"
      >
        <div className="hidden gap-2 sm:flex sm:flex-row">
          <Button disabled={isPending} onClick={onCancel} type="button" variant="outline">
            <X aria-hidden="true" />
            {t("actions.cancel")}
          </Button>
          {onCancelPlan && (
            <Button
              disabled={isPending}
              onClick={onCancelPlan}
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
              {t("actions.cancelPlan")}
            </Button>
          )}
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
          <Button
            className="min-w-0 px-2 sm:px-4"
            disabled={isPending}
            onClick={() => void saveDraft()}
            type="button"
            variant="outline"
          >
            {syncMutation.isPending ? <Spinner /> : <Save aria-hidden="true" />}
            {t("actions.saveDraft")}
          </Button>
          <Button
            className="min-w-0 px-2 sm:px-4"
            disabled={isPending || stagedItems.length === 0}
            onClick={() => void createTreatmentPlan()}
            type="button"
          >
            {isPending ? <Spinner /> : <Check aria-hidden="true" />}
            <span className="sm:hidden">{t("actions.createPlan")}</span>
            <span className="hidden sm:inline">
              {t("actions.createTreatmentPlan")}
            </span>
          </Button>
        </div>
      </div>

      <AlertDialog onOpenChange={setClearAllOpen} open={clearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.clearAll.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialogs.clearAll.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.close")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setStagedItems([]);
                resetComposer();
              }}
              variant="destructive"
            >
              {t("actions.clearAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialogs.discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {t("actions.keepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                allowNavigationRef.current = true;
                blocker.proceed?.();
              }}
              variant="destructive"
            >
              {t("actions.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

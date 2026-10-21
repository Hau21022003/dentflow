import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormDialog,
  RHFSelect,
  type RHFSelectOption,
  RHFTextField,
  RHFTextarea,
} from "@/components/form";
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
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDaysInTimeZone,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import {
  useArchivePatientFileMutation,
  useCreatePatientFileMutation,
  usePatientFilesQuery,
  useUpdatePatientFileMutation,
} from "@/features/patient-files/patient-files.hooks";
import { patientFilesService } from "@/features/patient-files/patient-files.service";
import {
  PATIENT_FILE_CONTENT_TYPES,
  PATIENT_FILE_MAX_BYTES,
  uploadTemporaryPatientFile,
} from "@/features/patient-files/patient-file-upload";
import {
  PATIENT_FILE_CATEGORIES,
  type PatientFile,
  type PatientFileCategory,
  type PatientFileListQuery,
} from "@/features/patient-files/patient-files.types";
import { getErrorMessage, handleApiError } from "@/shared/lib/error";
import { idempotencyKeyForIntent } from "@/shared/lib/idempotency";
import { localeForLanguage } from "@/shared/lib/money";
import {
  Archive,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  ImageIcon,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

const ALL = "__all__";
const PAGE_SIZE = 24;

type Props = {
  tenantSlug: string;
  branchSlug: string;
  appointmentId: string;
  timeZone: string;
  canManage: boolean;
};

type DatePreset = "ALL" | "TODAY" | "LAST_7" | "LAST_30";
type SortPreset = "NEWEST" | "OLDEST" | "UPLOADED";

const CATEGORY_ICONS = {
  CLINICAL_PHOTO: Camera,
  XRAY: ImageIcon,
  DOCUMENT: FileText,
  FORM: FileText,
  OTHER: FolderOpen,
} satisfies Record<PatientFileCategory, typeof Camera>;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateRangeForPreset(
  preset: DatePreset,
  timeZone: string,
): Pick<PatientFileListQuery, "dateFrom" | "dateTo"> {
  if (preset === "ALL") return {};
  const today = todayInTimeZone(timeZone);
  if (preset === "TODAY") return { dateFrom: today, dateTo: today };
  return {
    dateFrom: addDaysInTimeZone(
      today,
      preset === "LAST_7" ? -6 : -29,
      timeZone,
    ),
    dateTo: today,
  };
}

function sortForPreset(
  preset: SortPreset,
): Pick<PatientFileListQuery, "sortBy" | "sortOrder"> {
  if (preset === "UPLOADED") return { sortBy: "createdAt", sortOrder: "DESC" };
  return {
    sortBy: "fileDate",
    sortOrder: preset === "OLDEST" ? "ASC" : "DESC",
  };
}

type PatientFileFormValues = {
  category: PatientFileCategory;
  fileDate: string;
  note: string;
  uploadFile: File | null;
};

function PatientFileFormDialog({
  file,
  open,
  onOpenChange,
  scope,
  timeZone,
}: {
  file?: PatientFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: Pick<Props, "tenantSlug" | "branchSlug" | "appointmentId">;
  timeZone: string;
}) {
  const { t } = useTranslation("patientFiles");
  const { t: tValidation } = useTranslation("validation");
  const inputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreatePatientFileMutation();
  const updateMutation = useUpdatePatientFileMutation();
  const maxFileDate = todayInTimeZone(timeZone);
  const defaultValues = useMemo<PatientFileFormValues>(
    () => ({
      category: file?.category ?? "CLINICAL_PHOTO",
      fileDate: file?.fileDate ?? maxFileDate,
      note: file?.note ?? "",
      uploadFile: null,
    }),
    [file, maxFileDate],
  );
  const categoryOptions = useMemo(
    () =>
      PATIENT_FILE_CATEGORIES.map((value) => ({
        label: t(`categories.${value}`),
        value,
      })) satisfies RHFSelectOption[],
    [t],
  );
  const schema = useMemo(
    () =>
      z
        .object({
          category: z.enum(PATIENT_FILE_CATEGORIES),
          fileDate: z
            .string()
            .min(1, t("validation.dateRequired"))
            .refine(
              (value) => value === "" || value <= maxFileDate,
              t("validation.dateFuture"),
            ),
          note: z
            .string()
            .max(
              500,
              tValidation("maxLength", {
                field: t("fields.note"),
                max: 500,
              }),
            ),
          uploadFile: z.custom<File | null>(
            (value) => value === null || value instanceof File,
          ),
        })
        .superRefine((values, context) => {
          if (!file && !values.uploadFile) {
            context.addIssue({
              code: "custom",
              message: t("validation.required"),
              path: ["uploadFile"],
            });
            return;
          }

          if (!values.uploadFile) return;
          if (
            !PATIENT_FILE_CONTENT_TYPES.includes(
              values.uploadFile
                .type as (typeof PATIENT_FILE_CONTENT_TYPES)[number],
            )
          ) {
            context.addIssue({
              code: "custom",
              message: t("validation.type"),
              path: ["uploadFile"],
            });
          }
          if (
            values.uploadFile.size < 1 ||
            values.uploadFile.size > PATIENT_FILE_MAX_BYTES
          ) {
            context.addIssue({
              code: "custom",
              message: t("validation.size"),
              path: ["uploadFile"],
            });
          }
        }),
    [file, maxFileDate, t, tValidation],
  );
  const {
    clearErrors,
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<PatientFileFormValues>({
    defaultValues,
    resolver: zodResolver(schema),
  });
  const selectedFile = useWatch({ control, name: "uploadFile" });
  const note = useWatch({ control, name: "note" });

  useEffect(() => {
    if (!open) return;
    reset(defaultValues);
    if (inputRef.current) inputRef.current.value = "";
  }, [defaultValues, open, reset]);

  function chooseFile(candidate: File | null) {
    if (!candidate) return;
    clearErrors("root.server");
    setValue("uploadFile", candidate, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset(defaultValues);
      if (inputRef.current) inputRef.current.value = "";
    }
    onOpenChange(nextOpen);
  }

  async function submit(values: PatientFileFormValues) {
    const note = values.note.trim() || null;
    try {
      if (file) {
        const intent = idempotencyKeyForIntent(null, {
          operation: "clinical.patient-file.update",
          ...scope,
          fileId: file.id,
          category: values.category,
          note,
          fileDate: values.fileDate,
        });
        await updateMutation.mutateAsync({
          ...scope,
          fileId: file.id,
          idempotencyKey: intent.key,
          input: {
            category: values.category,
            note,
            fileDate: values.fileDate,
          },
        });
        toast.success(t("feedback.updated"));
      } else {
        const uploaded = await uploadTemporaryPatientFile({
          tenantSlug: scope.tenantSlug,
          branchSlug: scope.branchSlug,
          file: values.uploadFile!,
        });
        const input = {
          objectKey: uploaded.objectKey,
          originalFileName: values.uploadFile!.name,
          category: values.category,
          note,
          fileDate: values.fileDate,
        };
        const intent = idempotencyKeyForIntent(null, {
          operation: "clinical.patient-file.create",
          ...scope,
          ...input,
        });
        await createMutation.mutateAsync({
          ...scope,
          input,
          idempotencyKey: intent.key,
        });
        toast.success(t("feedback.uploaded"));
      }
      onOpenChange(false);
    } catch (caught) {
      handleApiError<PatientFileFormValues>({ error: caught, setError });
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <FormDialog
      cancelText={t("actions.cancel")}
      contentClassName="sm:max-w-xl"
      description={file ? t("edit.description") : t("upload.description")}
      isDirty={isDirty}
      isSubmitting={pending}
      noValidate
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit(submit)}
      open={open}
      submitText={file ? t("actions.save") : t("actions.upload")}
      title={file ? t("edit.title") : t("upload.title")}
    >
      <div className="space-y-5">
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}

        {!file && (
          <div>
            <div
              aria-describedby={
                errors.uploadFile?.message
                  ? "patient-file-upload-error"
                  : undefined
              }
              aria-invalid={Boolean(errors.uploadFile)}
              className="grid min-h-40 place-items-center rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-5 text-center aria-invalid:border-destructive"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <div className="min-w-0 space-y-3">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Upload aria-hidden="true" className="size-5" />
                </span>
                {selectedFile ? (
                  <div className="min-w-0">
                    <p className="max-w-sm truncate font-medium">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">{t("upload.drop")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("upload.support")}
                    </p>
                  </div>
                )}
                <input
                  accept={PATIENT_FILE_CONTENT_TYPES.join(",")}
                  className="sr-only"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    chooseFile(event.target.files?.[0] ?? null)
                  }
                  ref={inputRef}
                  type="file"
                />
                <Button
                  onClick={() => {
                    if (!inputRef.current) return;
                    inputRef.current.value = "";
                    inputRef.current.click();
                  }}
                  type="button"
                  variant="outline"
                >
                  {selectedFile ? t("upload.change") : t("upload.choose")}
                </Button>
              </div>
            </div>
            {errors.uploadFile?.message && (
              <p
                className="mt-2 text-xs text-destructive"
                id="patient-file-upload-error"
              >
                {errors.uploadFile.message}
              </p>
            )}
          </div>
        )}

        <RHFSelect
          control={control}
          fullWidth
          label={t("fields.category")}
          name="category"
          options={categoryOptions}
          required
        />

        <div>
          <RHFTextarea
            className="min-h-28"
            control={control}
            fullWidth
            label={t("fields.note")}
            maxLength={500}
            name="note"
            placeholder={t("fields.notePlaceholder")}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {note.length}/500
          </p>
        </div>

        <RHFTextField
          control={control}
          fullWidth
          label={t("fields.fileDate")}
          max={maxFileDate}
          name="fileDate"
          required
          type="date"
        />
      </div>
    </FormDialog>
  );
}

function PatientFilePreview({
  files,
  selected,
  onSelect,
  onClose,
  onEdit,
  onArchive,
  onDownload,
  canManage,
  locale,
}: {
  files: PatientFile[];
  selected: PatientFile | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onEdit: (file: PatientFile) => void;
  onArchive: (file: PatientFile) => void;
  onDownload: (file: PatientFile) => void;
  canManage: boolean;
  locale: string;
}) {
  const { t } = useTranslation("patientFiles");
  const [transform, setTransform] = useState({
    fileId: "",
    zoom: 1,
    rotation: 0,
  });
  const index = selected
    ? files.findIndex((file) => file.id === selected.id)
    : -1;

  if (!selected) return null;
  const isImage = selected.contentType.startsWith("image/");
  const zoom = transform.fileId === selected.id ? transform.zoom : 1;
  const rotation = transform.fileId === selected.id ? transform.rotation : 0;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(selected.createdAt));

  function move(offset: number) {
    if (files.length < 2) return;
    onSelect(files[(index + offset + files.length) % files.length].id);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="h-[calc(100dvh-1rem)] max-h-[900px] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden bg-zinc-950 p-0 text-white sm:h-[min(82vh,760px)] sm:max-w-6xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {selected.originalFileName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("preview.description")}
        </DialogDescription>
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex h-12 items-center gap-1 border-b border-white/10 px-3">
              <FileImage className="size-4" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {selected.originalFileName}
              </span>
              {isImage && (
                <>
                  <Button
                    aria-label={t("actions.zoomOut")}
                    onClick={() =>
                      setTransform((value) => ({
                        fileId: selected.id,
                        rotation:
                          value.fileId === selected.id ? value.rotation : 0,
                        zoom: Math.max(
                          0.5,
                          (value.fileId === selected.id ? value.zoom : 1) - 0.25,
                        ),
                      }))
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ZoomOut />
                  </Button>
                  <Button
                    aria-label={t("actions.zoomIn")}
                    onClick={() =>
                      setTransform((value) => ({
                        fileId: selected.id,
                        rotation:
                          value.fileId === selected.id ? value.rotation : 0,
                        zoom: Math.min(
                          3,
                          (value.fileId === selected.id ? value.zoom : 1) + 0.25,
                        ),
                      }))
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ZoomIn />
                  </Button>
                  <Button
                    aria-label={t("actions.rotate")}
                    onClick={() =>
                      setTransform((value) => ({
                        fileId: selected.id,
                        rotation:
                          (value.fileId === selected.id ? value.rotation : 0) +
                          90,
                        zoom: value.fileId === selected.id ? value.zoom : 1,
                      }))
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <RotateCw />
                  </Button>
                </>
              )}
              <Button
                aria-label={t("actions.download")}
                onClick={() => onDownload(selected)}
                size="icon-sm"
                variant="ghost"
              >
                <Download />
              </Button>
              <Button
                aria-label={t("actions.close")}
                onClick={onClose}
                size="icon-sm"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-hidden bg-black"
              data-slot="patient-file-preview-stage"
            >
              <div
                className="flex h-full min-h-0 items-center justify-center overflow-auto p-3 sm:p-4"
                data-slot="patient-file-preview-scroll"
              >
                {selected.previewUrl ? (
                  isImage ? (
                    <img
                      alt={selected.originalFileName}
                      className="max-h-full max-w-full rounded object-contain transition-transform"
                      src={selected.previewUrl}
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      }}
                    />
                  ) : (
                    <iframe
                      className="h-full min-h-0 w-full rounded bg-white"
                      src={selected.previewUrl}
                      title={selected.originalFileName}
                    />
                  )
                ) : (
                  <div className="text-center text-zinc-400">
                    <FileText className="mx-auto mb-3 size-14" />
                    <p>{t("preview.unavailable")}</p>
                  </div>
                )}
              </div>
              {files.length > 1 && (
                <>
                  <Button
                    aria-label={t("actions.previous")}
                    className="absolute left-2 top-1/2 z-10 size-10 -translate-y-1/2 touch-manipulation rounded-full shadow-lg sm:left-3"
                    data-slot="patient-file-preview-previous"
                    onClick={() => move(-1)}
                    size="icon"
                    variant="secondary"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    aria-label={t("actions.next")}
                    className="absolute right-2 top-1/2 z-10 size-10 -translate-y-1/2 touch-manipulation rounded-full shadow-lg sm:right-3"
                    data-slot="patient-file-preview-next"
                    onClick={() => move(1)}
                    size="icon"
                    variant="secondary"
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
            <div
              className="hidden h-20 shrink-0 gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain border-t border-white/10 p-2 sm:flex"
              data-slot="patient-file-preview-filmstrip"
            >
              {files.map((file) => (
                <button
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded border ${file.id === selected.id ? "border-primary" : "border-white/20"}`}
                  key={file.id}
                  onClick={() => onSelect(file.id)}
                  type="button"
                >
                  {file.contentType.startsWith("image/") && file.previewUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={file.previewUrl}
                    />
                  ) : (
                    <FileText className="mx-auto size-7 text-zinc-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <aside
            className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden border-t border-white/10 bg-zinc-900 md:block md:overflow-y-auto md:border-l md:border-t-0 md:p-5"
            data-slot="patient-file-preview-details"
          >
            <div
              className="overscroll-contain overflow-y-auto p-4 md:overflow-visible md:p-0"
              data-slot="patient-file-preview-details-scroll"
            >
              <p className="break-words font-semibold">
                {selected.originalFileName}
              </p>
              <Badge className="mt-2" variant="secondary">
                {t(`categories.${selected.category}`)}
              </Badge>
              <dl className="mt-5 space-y-4 text-sm md:mt-6">
                <div>
                  <dt className="text-zinc-400">{t("fields.fileDate")}</dt>
                  <dd className="mt-1">{selected.fileDate}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t("preview.uploadedBy")}</dt>
                  <dd className="mt-1">{selected.createdBy.fullName}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t("preview.uploadedAt")}</dt>
                  <dd className="mt-1">{date}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">{t("fields.note")}</dt>
                  <dd className="mt-1 whitespace-pre-wrap">
                    {selected.note || t("preview.noNote")}
                  </dd>
                </div>
              </dl>
            </div>
            {canManage && (
              <div
                className="grid gap-2 border-t border-white/10 bg-zinc-900 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:mt-6 md:border-0 md:bg-transparent md:p-0"
                data-slot="patient-file-preview-actions"
              >
                <Button onClick={() => onEdit(selected)} variant="secondary">
                  <Pencil />
                  {t("actions.edit")}
                </Button>
                <Button
                  onClick={() => onArchive(selected)}
                  variant="destructive"
                >
                  <Archive />
                  {t("actions.archive")}
                </Button>
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PatientFilesTab(props: Props) {
  const { t, i18n } = useTranslation("patientFiles");
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [sort, setSort] = useState<SortPreset>("NEWEST");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<PatientFile | undefined>();
  const [archiving, setArchiving] = useState<PatientFile | null>(null);
  const archiveMutation = useArchivePatientFileMutation();
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const scope = {
    tenantSlug: props.tenantSlug,
    branchSlug: props.branchSlug,
    appointmentId: props.appointmentId,
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo<PatientFileListQuery>(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(category !== ALL
        ? { category: category as PatientFileCategory }
        : {}),
      ...dateRangeForPreset(datePreset, props.timeZone),
      ...sortForPreset(sort),
    }),
    [category, datePreset, debouncedSearch, page, props.timeZone, sort],
  );
  const filesQuery = usePatientFilesQuery(scope, query);
  const files = filesQuery.data?.items ?? [];
  const selectedId = searchParams.get("fileId");
  const selected = files.find((file) => file.id === selectedId) ?? null;
  const totalPages = Math.max(
    1,
    Math.ceil((filesQuery.data?.meta.total ?? 0) / PAGE_SIZE),
  );
  const allCount = Object.values(
    filesQuery.data?.meta.categoryCounts ?? {},
  ).reduce((sum, count) => sum + count, 0);

  function selectFile(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("fileId", id);
    else params.delete("fileId");
    setSearchParams(params);
  }

  async function download(file: PatientFile) {
    try {
      const access = await patientFilesService.access(
        scope,
        file.id,
        "attachment",
      );
      window.open(access.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function archive() {
    if (!archiving) return;
    try {
      const intent = idempotencyKeyForIntent(null, {
        operation: "clinical.patient-file.archive",
        ...scope,
        fileId: archiving.id,
      });
      await archiveMutation.mutateAsync({
        ...scope,
        fileId: archiving.id,
        idempotencyKey: intent.key,
      });
      if (selectedId === archiving.id) selectFile(null);
      setArchiving(null);
      toast.success(t("feedback.archived"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b p-4 sm:p-6">
        <div className="min-w-0">
          <CardTitle>{t("title")}</CardTitle>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            {t("description")}
          </p>
        </div>
        {props.canManage && (
          <Button className="shrink-0" onClick={() => setUploadOpen(true)}>
            <Plus />
            {t("actions.add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid min-w-0 md:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="min-w-0 border-b p-3 md:border-b-0 md:border-r">
            <div
              className="no-scrollbar flex w-full gap-2 overflow-x-auto overscroll-x-contain pb-0.5 md:block md:space-y-1 md:pb-0"
              data-slot="patient-file-categories"
            >
              <button
                aria-pressed={category === ALL}
                className={`flex shrink-0 items-center gap-2 rounded-[12px] px-3 py-2 text-sm max-md:rounded-full max-md:border max-md:transition-colors md:w-full md:gap-1.5 md:px-1.5 md:py-1.5 ${category === ALL ? "bg-primary/10 font-semibold text-primary max-md:border-primary" : "hover:bg-muted max-md:border-transparent max-md:bg-muted/70 md:bg-card md:hover:bg-muted/50"}`}
                onClick={() => {
                  setCategory(ALL);
                  setPage(1);
                }}
                type="button"
              >
                <span
                  className={`contents md:grid md:size-8 md:shrink-0 md:place-items-center md:rounded-lg ${category === ALL ? "md:bg-primary/10 md:text-primary" : "md:bg-muted/60 md:text-muted-foreground"}`}
                  data-slot="patient-file-category-icon"
                >
                  <FolderOpen className="size-4 shrink-0" />
                </span>
                <span className="flex-1 text-left md:min-w-0 md:truncate">
                  {t("categories.ALL")}
                </span>
                <span
                  className={`max-md:grid max-md:size-6 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:text-xs max-md:font-semibold md:ml-auto md:grid md:h-7 md:min-w-7 md:place-items-center md:rounded-full md:px-2 md:text-xs md:font-semibold ${category === ALL ? "max-md:bg-primary max-md:text-primary-foreground md:bg-primary/10 md:text-primary" : "max-md:bg-background/80 max-md:text-muted-foreground max-md:ring-1 max-md:ring-border/70 md:bg-muted/70 md:text-muted-foreground"}`}
                  data-slot="patient-file-category-count"
                >
                  {allCount}
                </span>
              </button>
              {PATIENT_FILE_CATEGORIES.map((value) => {
                const Icon = CATEGORY_ICONS[value];
                const selected = category === value;
                return (
                  <button
                    aria-pressed={selected}
                    className={`flex shrink-0 items-center gap-2 rounded-[12px] px-3 py-2 text-sm max-md:rounded-full max-md:border max-md:transition-colors md:w-full md:gap-1.5 md:px-1.5 md:py-1.5 ${selected ? "bg-primary/10 font-semibold text-primary max-md:border-primary" : "hover:bg-muted max-md:border-transparent max-md:bg-muted/70 md:bg-card md:hover:bg-muted/50"}`}
                    key={value}
                    onClick={() => {
                      setCategory(value);
                      setPage(1);
                    }}
                    type="button"
                  >
                    <span
                      className={`contents md:grid md:size-8 md:shrink-0 md:place-items-center md:rounded-lg ${selected ? "md:bg-primary/10 md:text-primary" : "md:bg-muted/60 md:text-muted-foreground"}`}
                      data-slot="patient-file-category-icon"
                    >
                      <Icon className="size-4 shrink-0" />
                    </span>
                    <span className="flex-1 text-left md:min-w-0 md:truncate">
                      {t(`categories.${value}`)}
                    </span>
                    <span
                      className={`max-md:grid max-md:size-6 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:text-xs max-md:font-semibold md:ml-auto md:grid md:h-7 md:min-w-7 md:place-items-center md:rounded-full md:px-2 md:text-xs md:font-semibold ${selected ? "max-md:bg-primary max-md:text-primary-foreground md:bg-primary/10 md:text-primary" : "max-md:bg-background/80 max-md:text-muted-foreground max-md:ring-1 max-md:ring-border/70 md:bg-muted/70 md:text-muted-foreground"}`}
                      data-slot="patient-file-category-count"
                    >
                      {filesQuery.data?.meta.categoryCounts[value] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="min-w-0 p-3 sm:p-4">
            <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(15rem,1fr)_11rem_11rem]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
                <Input
                  className="h-11 rounded-xl bg-muted/40 pl-10 shadow-none sm:h-10 sm:rounded-lg sm:bg-background sm:pl-9 sm:shadow-xs"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("filters.search")}
                  value={search}
                />
              </label>
              <Select
                onValueChange={(value) => {
                  setDatePreset(value as DatePreset);
                  setPage(1);
                }}
                value={datePreset}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted/40 shadow-none sm:h-10 sm:rounded-lg sm:bg-background sm:shadow-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["ALL", "TODAY", "LAST_7", "LAST_30"] as DatePreset[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {t(`filters.dates.${value}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => {
                  setSort(value as SortPreset);
                  setPage(1);
                }}
                value={sort}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted/40 shadow-none sm:h-10 sm:rounded-lg sm:bg-background sm:shadow-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["NEWEST", "OLDEST", "UPLOADED"] as SortPreset[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {t(`filters.sort.${value}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {filesQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    className="h-48 animate-pulse rounded-xl bg-muted"
                    key={index}
                  />
                ))}
              </div>
            ) : filesQuery.isError ? (
              <Alert variant="destructive">
                <div className="flex items-center justify-between gap-3">
                  <span>{t("states.loadError")}</span>
                  <Button
                    onClick={() => void filesQuery.refetch()}
                    size="sm"
                    variant="outline"
                  >
                    {t("actions.retry")}
                  </Button>
                </div>
              </Alert>
            ) : files.length === 0 ? (
              <Empty className="border border-dashed py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpen />
                  </EmptyMedia>
                  <EmptyTitle>{t("states.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>
                    {t("states.emptyDescription")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {files.map((file) => {
                  const FallbackIcon = CATEGORY_ICONS[file.category];
                  return (
                    <article
                      className="group min-w-0 overflow-hidden rounded-2xl border bg-card shadow-xs sm:rounded-xl"
                      data-slot="patient-file-card"
                      key={file.id}
                    >
                      <button
                        className="grid min-w-0 w-full grid-cols-[4.75rem_minmax(0,1fr)] overflow-hidden text-left sm:block"
                        onClick={() => selectFile(file.id)}
                        type="button"
                      >
                        <div className="grid h-full min-h-24 place-items-center overflow-hidden bg-muted/50 sm:h-32 sm:min-h-0">
                          {file.contentType.startsWith("image/") &&
                          file.previewUrl ? (
                            <img
                              alt={file.originalFileName}
                              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                              loading="lazy"
                              src={file.previewUrl}
                            />
                          ) : (
                            <FallbackIcon className="size-9 text-muted-foreground sm:size-12" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1 overflow-hidden p-3 sm:overflow-visible">
                          <p
                            className="truncate text-sm font-semibold"
                            title={file.originalFileName}
                          >
                            {file.originalFileName}
                          </p>
                          <Badge variant="secondary">
                            {t(`categories.${file.category}`)}
                          </Badge>
                          <div className="flex justify-between gap-2 text-xs text-muted-foreground max-sm:min-w-0">
                            <span className="max-sm:shrink-0">{file.fileDate}</span>
                            <span className="max-sm:shrink-0">
                              {formatBytes(file.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-end gap-2">
                <span className="mr-2 text-sm text-muted-foreground">
                  {t("pagination", { page, total: totalPages })}
                </span>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  size="sm"
                  variant="outline"
                >
                  <ChevronLeft />
                  {t("actions.previous")}
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  size="sm"
                  variant="outline"
                >
                  {t("actions.next")}
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <PatientFileFormDialog
        file={editing}
        key={`form-${editing?.id ?? (uploadOpen ? "upload" : "closed")}`}
        onOpenChange={(open) => {
          if (!open) {
            setUploadOpen(false);
            setEditing(undefined);
          }
        }}
        open={uploadOpen || Boolean(editing)}
        scope={scope}
        timeZone={props.timeZone}
      />
      <PatientFilePreview
        canManage={props.canManage}
        files={files}
        locale={locale}
        onArchive={(file) => {
          selectFile(null);
          setArchiving(file);
        }}
        onClose={() => selectFile(null)}
        onDownload={(file) => void download(file)}
        onEdit={(file) => {
          selectFile(null);
          setEditing(file);
        }}
        onSelect={selectFile}
        selected={selected}
      />
      <AlertDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archive.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("archive.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiveMutation.isPending}
              onClick={() => void archive()}
              variant="destructive"
            >
              {t("actions.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

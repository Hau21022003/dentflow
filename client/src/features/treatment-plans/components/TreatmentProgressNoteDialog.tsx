import { RHFTextarea } from "@/components/form/RHFTextarea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useCreateTreatmentProgressNoteMutation } from "@/features/treatment-plans/treatment-plans.hooks";
import type { TreatmentPlanScope } from "@/features/treatment-plans/treatment-plans.service";
import type { TreatmentPlanItem } from "@/features/treatment-plans/treatment-plans.types";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import {
  TREATMENT_PROGRESS_IMAGE_MAX_BYTES,
  uploadTempImage,
} from "@/shared/lib/temp-image-upload";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TreatmentImagePreviewDialog } from "./TreatmentImagePreviewDialog";

const MAX_IMAGES = 5;
const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type FormValues = { content: string };
type SelectedImage = {
  file: File;
  id: string;
  objectKey?: string;
  previewUrl: string;
};

type Props = {
  item: TreatmentPlanItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  planId: string;
  scope: TreatmentPlanScope;
  timeZone: string;
};

export function TreatmentProgressNoteDialog({
  item,
  onOpenChange,
  open,
  planId,
  scope,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("treatmentPlans");
  const mutation = useCreateTreatmentProgressNoteMutation();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const imagesRef = useRef<SelectedImage[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedAt] = useState(() => new Date());
  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const intentRef = useRef<IdempotencyIntent | null>(null);
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { content: "" },
  });
  const content = useWatch({ control, name: "content" }) ?? "";

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  function clearForm() {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    imagesRef.current = [];
    setImages([]);
    setFileError("");
    setSubmitError("");
    setPreviewUrl(null);
    intentRef.current = null;
    reset({ content: "" });
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      clearForm();
    }
    onOpenChange(nextOpen);
  }

  function selectImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (images.length + selected.length > MAX_IMAGES) {
      setFileError(
        t("progress.validation.tooManyImages", { count: MAX_IMAGES }),
      );
      return;
    }
    if (selected.some((file) => !IMAGE_CONTENT_TYPES.has(file.type))) {
      setFileError(t("progress.validation.imageType"));
      return;
    }
    if (selected.some((file) => file.size < 1)) {
      setFileError(t("progress.validation.imageEmpty"));
      return;
    }
    if (
      selected.some((file) => file.size > TREATMENT_PROGRESS_IMAGE_MAX_BYTES)
    ) {
      setFileError(t("progress.validation.imageSize"));
      return;
    }

    setFileError("");
    setImages((current) => [
      ...current,
      ...selected.map((file) => ({
        file,
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    setFileError("");
  }

  async function submit(values: FormValues) {
    if (!item || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const pending = images.filter((image) => !image.objectKey);
      if (pending.length) {
        const settled = await Promise.allSettled(
          pending.map(async (image) => ({
            id: image.id,
            uploaded: await uploadTempImage({
              ...scope,
              file: image.file,
              purpose: "TREATMENT_PROGRESS",
              signal: controller.signal,
            }),
          })),
        );
        if (controller.signal.aborted) return;

        const uploadedById = new Map(
          settled.flatMap((result) =>
            result.status === "fulfilled"
              ? [[result.value.id, result.value.uploaded.objectKey] as const]
              : [],
          ),
        );
        const resolvedImages = images.map((image) => ({
          ...image,
          objectKey: image.objectKey ?? uploadedById.get(image.id),
        }));
        setImages(resolvedImages);
        imagesRef.current = resolvedImages;
        if (settled.some((result) => result.status === "rejected")) {
          setSubmitError(t("progress.errors.upload"));
          return;
        }
      }

      const objectKeys = imagesRef.current.map((image) => image.objectKey);
      if (objectKeys.some((key) => !key)) {
        setSubmitError(t("progress.errors.upload"));
        return;
      }
      const input = {
        content: values.content.trim(),
        imageObjectKeys: objectKeys as string[],
      };
      const intent = idempotencyKeyForIntent(intentRef.current, {
        operation: "clinical.treatment-item.progress-note.create",
        ...scope,
        planId,
        itemId: item.id,
        ...input,
      });
      intentRef.current = intent;

      await mutation.mutateAsync({
        ...scope,
        idempotencyKey: intent.key,
        input,
        itemId: item.id,
        planId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      toast.success(t("progress.success"), { position: "top-right" });
      clearForm();
      onOpenChange(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      handleApiError({ error, onMessage: setSubmitError });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const formattedTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(recordedAt);

  return (
    <>
      <Dialog onOpenChange={handleDialogOpenChange} open={open}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b p-4 pr-14 sm:p-5 sm:pr-14">
            <DialogTitle className="text-xl">{t("progress.title")}</DialogTitle>
            {item && (
              <div className="space-y-2">
                <p className="font-semibold">{item.serviceName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.toothPosition
                    ? t("detail.toothValue", { position: item.toothPosition })
                    : t("detail.noTooth")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="border-blue-200 bg-blue-50 text-blue-700"
                    variant="outline"
                  >
                    {t("statuses.item.IN_PROGRESS")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("progress.recordedAt", { date: formattedTime })}
                  </span>
                </div>
              </div>
            )}
            <Button
              aria-label={t("actions.close")}
              className="absolute top-4 right-4"
              onClick={() => handleDialogOpenChange(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogHeader>

          <form
            className="contents"
            id="treatment-progress-note-form"
            noValidate
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-5">
              {submitError && (
                <Alert variant="destructive">{submitError}</Alert>
              )}
              <RHFTextarea
                className="min-h-28 resize-y"
                control={control}
                disabled={isSubmitting}
                fullWidth
                helperText={t("progress.characterCount", {
                  count: content.length,
                })}
                label={t("progress.content")}
                maxLength={2000}
                name="content"
                placeholder={t("progress.contentPlaceholder")}
                required
                rules={{
                  maxLength: {
                    value: 2000,
                    message: t("progress.validation.contentMax"),
                  },
                  validate: (value) =>
                    value.trim().length > 0 ||
                    t("progress.validation.contentRequired"),
                }}
              />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{t("progress.images")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("progress.imagesHint", { count: MAX_IMAGES })}
                  </p>
                </div>
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-3 text-center hover:bg-muted/30">
                  <ImagePlus
                    aria-hidden="true"
                    className="mb-1 size-6 text-muted-foreground"
                  />
                  <span className="font-medium">
                    {t("progress.chooseImages")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("progress.imageFormats")}
                  </span>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isSubmitting || images.length >= MAX_IMAGES}
                    multiple
                    onChange={(event) => {
                      selectImages(event.target.files);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
                {fileError && <Alert variant="destructive">{fileError}</Alert>}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {images.map((image, index) => (
                      <div
                        className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                        key={image.id}
                      >
                        <button
                          aria-label={t("progress.previewImage", {
                            count: index + 1,
                          })}
                          className="size-full"
                          onClick={() => setPreviewUrl(image.previewUrl)}
                          type="button"
                        >
                          <img
                            alt={t("progress.imageAlt", { count: index + 1 })}
                            className="size-full object-cover"
                            src={image.previewUrl}
                          />
                        </button>
                        <Button
                          aria-label={t("progress.removeImage", {
                            count: index + 1,
                          })}
                          className="absolute top-1 right-1 bg-background/90 text-destructive hover:bg-background hover:text-destructive"
                          disabled={isSubmitting}
                          onClick={() => removeImage(image.id)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="m-0 rounded-none px-4 py-3 sm:px-5">
              <Button
                onClick={() => handleDialogOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("actions.cancel")}
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? <Spinner /> : <Check aria-hidden="true" />}
                {isSubmitting ? t("actions.saving") : t("progress.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TreatmentImagePreviewDialog
        onOpenChange={(nextOpen) => !nextOpen && setPreviewUrl(null)}
        open={Boolean(previewUrl)}
        src={previewUrl}
      />
    </>
  );
}

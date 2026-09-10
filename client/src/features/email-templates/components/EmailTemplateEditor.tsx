import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  getEmailTemplateEditorDefinition,
  type EmailTemplateContentField,
} from "@/features/email-templates/email-template-definitions";
import {
  usePublishEmailTemplateDirectMutation,
  usePublishEmailTemplateDraftMutation,
  useSaveEmailTemplateDraftMutation,
} from "@/features/email-templates/email-templates.hooks";
import type {
  EmailTemplateContent,
  EmailTemplateDetail,
  EmailTemplateRevision,
} from "@/features/email-templates/email-templates.types";
import { ApiError, handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { zodResolver } from "@hookform/resolvers/zod";
import { Braces, Save, Send } from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

type PublishAction = "direct" | "draft";

type EmailTemplateEditorProps = {
  detail: EmailTemplateDetail;
  locale: string;
  onDirtyChange: (isDirty: boolean) => void;
  onServerStateChange: () => Promise<void>;
  templateKey: string;
};

const PLACEHOLDER_PATTERN = /{{([A-Za-z][A-Za-z0-9]*)}}/g;
const UNSUPPORTED_TEMPLATE_SYNTAX = /{{{|}}}|{{\s*[#/>!^]/;

function emptyContent(): EmailTemplateContent {
  return { subject: "", text: "", html: "" };
}

function contentFromRevision(
  revision: EmailTemplateRevision | null,
): EmailTemplateContent {
  if (!revision) return emptyContent();

  return {
    subject: revision.subject,
    text: revision.text,
    html: revision.html,
  };
}

function revisionIdentity(revision: EmailTemplateRevision | null): string {
  if (!revision) return "empty";

  return [revision.id, revision.status, revision.updatedAt].join(":");
}

function createEditorSchema({
  templateKey,
  translate,
}: {
  templateKey: string;
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  const definition = getEmailTemplateEditorDefinition(templateKey);
  const fieldLabel = (field: EmailTemplateContentField) =>
    translate(`editor.fields.${field}`);

  return z
    .object({
      subject: z
        .string()
        .trim()
        .min(1, translate("editor.validation.required", { field: fieldLabel("subject") }))
        .max(
          500,
          translate("editor.validation.maxLength", {
            field: fieldLabel("subject"),
            max: 500,
          }),
        )
        .refine(
          (value) => !/[\r\n]/.test(value),
          translate("editor.validation.subjectLineBreak"),
        ),
      text: z
        .string()
        .min(1, translate("editor.validation.required", { field: fieldLabel("text") }))
        .max(
          100_000,
          translate("editor.validation.maxLength", {
            field: fieldLabel("text"),
            max: 100_000,
          }),
        ),
      html: z
        .string()
        .min(1, translate("editor.validation.required", { field: fieldLabel("html") }))
        .max(
          100_000,
          translate("editor.validation.maxLength", {
            field: fieldLabel("html"),
            max: 100_000,
          }),
        ),
    })
    .superRefine((content, context) => {
      if (!definition) return;

      const allowedVariables = new Set(
        definition.variables.map((variable) => variable.name),
      );

      (Object.entries(content) as Array<
        [EmailTemplateContentField, string]
      >).forEach(([field, value]) => {
        if (UNSUPPORTED_TEMPLATE_SYNTAX.test(value)) {
          context.addIssue({
            code: "custom",
            message: translate("editor.validation.unsupportedSyntax", {
              field: fieldLabel(field),
            }),
            path: [field],
          });
          return;
        }

        const matches = [...value.matchAll(PLACEHOLDER_PATTERN)];
        if (/{{|}}/.test(value.replace(PLACEHOLDER_PATTERN, ""))) {
          context.addIssue({
            code: "custom",
            message: translate("editor.validation.invalidPlaceholder", {
              field: fieldLabel(field),
            }),
            path: [field],
          });
          return;
        }

        if (matches.some((match) => !allowedVariables.has(match[1]))) {
          context.addIssue({
            code: "custom",
            message: translate("editor.validation.unsupportedVariable", {
              field: fieldLabel(field),
            }),
            path: [field],
          });
        }
      });

      definition.variables
        .filter((variable) => variable.requiredIn.length > 0)
        .forEach((variable) => {
          variable.requiredIn.forEach((field) => {
            if (!content[field].includes(`{{${variable.name}}}`)) {
              context.addIssue({
                code: "custom",
                message: translate("editor.validation.requiredVariable", {
                  field: fieldLabel(field),
                  variable: translate(
                    `variables.${templateKey}.${variable.name}.label`,
                    { defaultValue: variable.name },
                  ),
                }),
                path: [field],
              });
            }
          });
        });
    });
}

function isConflict(error: unknown): boolean {
  return ApiError.from(error).status === 409;
}

function insertAtSelection({
  field,
  getValue,
  reference,
  setValue,
  variable,
}: {
  field: EmailTemplateContentField;
  getValue: (field: EmailTemplateContentField) => string;
  reference: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  setValue: (
    field: EmailTemplateContentField,
    value: string,
    options: { shouldDirty: boolean; shouldValidate: boolean },
  ) => void;
  variable: string;
}) {
  const element = reference.current;
  const value = getValue(field);
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  const token = `{{${variable}}}`;
  const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
  const nextCursorPosition = start + token.length;

  setValue(field, nextValue, { shouldDirty: true, shouldValidate: true });
  requestAnimationFrame(() => {
    element?.focus();
    element?.setSelectionRange(nextCursorPosition, nextCursorPosition);
  });
}

export function EmailTemplateEditor({
  detail,
  locale,
  onDirtyChange,
  onServerStateChange,
  templateKey,
}: EmailTemplateEditorProps) {
  const { t } = useTranslation("emailTemplates");
  const definition = getEmailTemplateEditorDefinition(templateKey);
  const initialRevision = detail.draft ?? detail.published;
  const initialIdentity = revisionIdentity(initialRevision);
  const initialIdentityRef = useRef(initialIdentity);
  const idempotencyIntent = useRef<IdempotencyIntent | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeVariablePicker, setActiveVariablePicker] =
    useState<EmailTemplateContentField | null>(null);
  const [confirmAction, setConfirmAction] = useState<PublishAction | null>(
    null,
  );
  const [hasConcurrentDraft, setHasConcurrentDraft] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const subjectId = useId();
  const textId = useId();
  const htmlId = useId();
  const schema = useMemo(
    () => createEditorSchema({ templateKey, translate: t }),
    [t, templateKey],
  );
  const {
    control,
    formState: { errors, isDirty },
    getValues,
    reset,
    setError,
    setValue,
    trigger,
  } = useForm<EmailTemplateContent>({
    defaultValues: contentFromRevision(initialRevision),
    resolver: zodResolver(schema),
  });
  const saveDraftMutation = useSaveEmailTemplateDraftMutation();
  const publishDirectMutation = usePublishEmailTemplateDirectMutation();
  const publishDraftMutation = usePublishEmailTemplateDraftMutation();
  const isPending =
    saveDraftMutation.isPending ||
    publishDirectMutation.isPending ||
    publishDraftMutation.isPending;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange(false);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    if (initialIdentityRef.current === initialIdentity || isDirty) return;

    initialIdentityRef.current = initialIdentity;
    reset(contentFromRevision(initialRevision));
    setHasConcurrentDraft(false);
  }, [initialIdentity, initialRevision, isDirty, reset]);

  function resetToRevision(revision: EmailTemplateRevision) {
    initialIdentityRef.current = revisionIdentity(revision);
    reset(contentFromRevision(revision));
    setHasConcurrentDraft(false);
  }

  function getInput(): EmailTemplateContent {
    const values = getValues();
    return { ...values, subject: values.subject.trim() };
  }

  function getIdempotencyKey(operation: string, input?: EmailTemplateContent) {
    idempotencyIntent.current = idempotencyKeyForIntent(
      idempotencyIntent.current,
      {
        operation,
        templateKey,
        locale,
        ...(input ? { input } : {}),
        ...(detail.draft
          ? { draftId: detail.draft.id, draftVersion: detail.draft.version }
          : {}),
      },
    );

    return idempotencyIntent.current.key;
  }

  async function refreshAfterConflict() {
    setHasConcurrentDraft(true);
    await onServerStateChange();
    setError("root.server", {
      type: "server",
      message: t("editor.conflict"),
    });
  }

  async function saveDraft(content: EmailTemplateContent) {
    setSuccessMessage(null);
    try {
      const revision = await saveDraftMutation.mutateAsync({
        templateKey,
        locale,
        input: content,
        idempotencyKey: getIdempotencyKey(
          "platform.email-template.draft.save",
          content,
        ),
      });
      idempotencyIntent.current = null;
      resetToRevision(revision);
      await onServerStateChange();
      setSuccessMessage(t("editor.success.draftSaved"));
    } catch (error) {
      if (isConflict(error)) {
        await refreshAfterConflict();
        return;
      }
      handleApiError<EmailTemplateContent>({ error, setError });
    }
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await trigger())) return;
    await saveDraft(getInput());
  }

  async function publishDirect() {
    const isValid = await trigger();
    if (!isValid) {
      setConfirmAction(null);
      return;
    }

    const content = getInput();
    setSuccessMessage(null);
    try {
      const revision = await publishDirectMutation.mutateAsync({
        templateKey,
        locale,
        input: content,
        idempotencyKey: getIdempotencyKey(
          "platform.email-template.direct.publish",
          content,
        ),
      });
      idempotencyIntent.current = null;
      resetToRevision(revision);
      await onServerStateChange();
      setConfirmAction(null);
      setSuccessMessage(t("editor.success.published"));
    } catch (error) {
      if (isConflict(error)) {
        await refreshAfterConflict();
        setConfirmAction(null);
        return;
      }
      handleApiError<EmailTemplateContent>({ error, setError });
    }
  }

  async function publishDraft() {
    if (!detail.draft) return;

    setSuccessMessage(null);
    try {
      const revision = await publishDraftMutation.mutateAsync({
        templateKey,
        locale,
        idempotencyKey: getIdempotencyKey(
          "platform.email-template.draft.publish",
        ),
      });
      idempotencyIntent.current = null;
      resetToRevision(revision);
      await onServerStateChange();
      setConfirmAction(null);
      setSuccessMessage(t("editor.success.published"));
    } catch (error) {
      if (isConflict(error)) {
        await refreshAfterConflict();
        setConfirmAction(null);
        return;
      }
      handleApiError<EmailTemplateContent>({ error, setError });
    }
  }

  async function openPublishDialog(action: PublishAction) {
    if (action === "direct" && !(await trigger())) return;
    setConfirmAction(action);
  }

  const fieldReferences: Record<
    EmailTemplateContentField,
    RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  > = {
    subject: subjectRef,
    text: textRef,
    html: htmlRef,
  };

  function renderVariablePicker(field: EmailTemplateContentField) {
    if (!definition) return null;

    return (
      <Popover
        onOpenChange={(open) =>
          setActiveVariablePicker(open ? field : null)
        }
        open={activeVariablePicker === field}
      >
        <PopoverTrigger asChild>
          <Button
            aria-label={t("editor.insertVariableFor", {
              field: t(`editor.fields.${field}`),
            })}
            disabled={isPending}
            size="sm"
            type="button"
            variant="outline"
          >
            <Braces aria-hidden="true" />
            {t("editor.insertVariable")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <PopoverHeader>
            <PopoverTitle>{t("editor.variablesTitle")}</PopoverTitle>
            <PopoverDescription>
              {t("editor.variablesDescription")}
            </PopoverDescription>
          </PopoverHeader>
          <div className="grid gap-1">
            {definition.variables.map((variable) => (
              <button
                className="rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                key={variable.name}
                onClick={() => {
                  insertAtSelection({
                    field,
                    getValue: (name) => getValues(name),
                    reference: fieldReferences[field],
                    setValue,
                    variable: variable.name,
                  });
                  setActiveVariablePicker(null);
                }}
                type="button"
              >
                <span className="block font-medium">
                  {t(`variables.${templateKey}.${variable.name}.label`, {
                    defaultValue: variable.name,
                  })}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(
                    `variables.${templateKey}.${variable.name}.description`,
                    { defaultValue: `{{${variable.name}}}` },
                  )}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <form className="space-y-6" noValidate onSubmit={(event) => void submitDraft(event)}>
        {errors.root?.server?.message && (
          <Alert variant="destructive">{errors.root.server.message}</Alert>
        )}
        {successMessage && <Alert>{successMessage}</Alert>}
        {hasConcurrentDraft && detail.draft && (
          <Alert className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("editor.concurrentDraft")}</span>
            <Button
              disabled={isPending}
              onClick={() => resetToRevision(detail.draft!)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("editor.loadLatestDraft")}
            </Button>
          </Alert>
        )}

        {!definition && (
          <Alert>{t("editor.definitionUnavailable")}</Alert>
        )}

        <div className="grid gap-5">
          <Controller
            control={control}
            name="subject"
            render={({ field, fieldState }) => (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={subjectId}>
                    {t("editor.fields.subject")}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  {renderVariablePicker("subject")}
                </div>
                <Input
                  aria-describedby={
                    fieldState.error ? `${subjectId}-message` : undefined
                  }
                  aria-invalid={Boolean(fieldState.error)}
                  disabled={isPending}
                  id={subjectId}
                  maxLength={500}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  ref={(element) => {
                    field.ref(element);
                    subjectRef.current = element;
                  }}
                  value={field.value}
                />
                {fieldState.error?.message && (
                  <p className="text-xs text-destructive" id={`${subjectId}-message`}>
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={control}
            name="text"
            render={({ field, fieldState }) => (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={textId}>
                    {t("editor.fields.text")}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  {renderVariablePicker("text")}
                </div>
                <Textarea
                  aria-describedby={
                    fieldState.error ? `${textId}-message` : undefined
                  }
                  aria-invalid={Boolean(fieldState.error)}
                  className="min-h-44 font-mono"
                  disabled={isPending}
                  id={textId}
                  maxLength={100_000}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  ref={(element) => {
                    field.ref(element);
                    textRef.current = element;
                  }}
                  value={field.value}
                />
                {fieldState.error?.message && (
                  <p className="text-xs text-destructive" id={`${textId}-message`}>
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <Controller
            control={control}
            name="html"
            render={({ field, fieldState }) => (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={htmlId}>
                    {t("editor.fields.html")}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  {renderVariablePicker("html")}
                </div>
                <Textarea
                  aria-describedby={
                    fieldState.error ? `${htmlId}-message` : undefined
                  }
                  aria-invalid={Boolean(fieldState.error)}
                  className="min-h-56 font-mono"
                  disabled={isPending}
                  id={htmlId}
                  maxLength={100_000}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  ref={(element) => {
                    field.ref(element);
                    htmlRef.current = element;
                  }}
                  value={field.value}
                />
                {fieldState.error?.message && (
                  <p className="text-xs text-destructive" id={`${htmlId}-message`}>
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">
          <Button disabled={isPending} type="submit" variant="outline">
            {saveDraftMutation.isPending ? (
              <Spinner aria-label={t("editor.actions.savingDraft")} />
            ) : (
              <Save aria-hidden="true" />
            )}
            {t("editor.actions.saveDraft")}
          </Button>
          {detail.draft ? (
            <Button
              disabled={isPending || isDirty}
              onClick={() => void openPublishDialog("draft")}
              type="button"
            >
              <Send aria-hidden="true" />
              {t("editor.actions.publishDraft")}
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={() => void openPublishDialog("direct")}
              type="button"
            >
              <Send aria-hidden="true" />
              {t("editor.actions.publishDirect")}
            </Button>
          )}
        </div>

        {detail.draft && isDirty && (
          <p className="text-right text-xs text-muted-foreground">
            {t("editor.saveBeforePublish")}
          </p>
        )}
      </form>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirmAction(null);
        }}
        open={confirmAction !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.publishDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor.publishDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} type="button">
              {t("editor.actions.cancel")}
            </AlertDialogCancel>
            <Button
              disabled={isPending}
              onClick={() =>
                void (confirmAction === "draft" ? publishDraft() : publishDirect())
              }
              type="button"
            >
              {isPending && <Spinner aria-label={t("editor.actions.publishing")} />}
              {t("editor.actions.confirmPublish")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

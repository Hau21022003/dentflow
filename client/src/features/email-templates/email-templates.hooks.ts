import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { emailTemplatesService } from "./email-templates.service";

export const emailTemplateQueryKeys = {
  all: ["email-templates"] as const,
  list: () => [...emailTemplateQueryKeys.all, "list"] as const,
  detail: (templateKey: string, locale: string) =>
    [...emailTemplateQueryKeys.all, "detail", templateKey, locale] as const,
};

export function useEmailTemplatesQuery() {
  return useQuery({
    queryKey: emailTemplateQueryKeys.list(),
    queryFn: emailTemplatesService.list,
  });
}

export function useEmailTemplateDetailQuery(
  templateKey: string,
  locale: string,
) {
  return useQuery({
    queryKey: emailTemplateQueryKeys.detail(templateKey, locale),
    queryFn: () => emailTemplatesService.get(templateKey, locale),
    enabled: Boolean(templateKey && locale),
  });
}

function useInvalidateEmailTemplateQueries() {
  const queryClient = useQueryClient();

  return async (templateKey: string, locale: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: emailTemplateQueryKeys.list(),
      }),
      queryClient.invalidateQueries({
        queryKey: emailTemplateQueryKeys.detail(templateKey, locale),
      }),
    ]);
  };
}

export function useSaveEmailTemplateDraftMutation() {
  const invalidate = useInvalidateEmailTemplateQueries();

  return useMutation({
    mutationFn: emailTemplatesService.saveDraft,
    onSuccess: async (_, command) => {
      await invalidate(command.templateKey, command.locale);
    },
  });
}

export function usePublishEmailTemplateDirectMutation() {
  const invalidate = useInvalidateEmailTemplateQueries();

  return useMutation({
    mutationFn: emailTemplatesService.publishDirect,
    onSuccess: async (_, command) => {
      await invalidate(command.templateKey, command.locale);
    },
  });
}

export function usePublishEmailTemplateDraftMutation() {
  const invalidate = useInvalidateEmailTemplateQueries();

  return useMutation({
    mutationFn: emailTemplatesService.publishDraft,
    onSuccess: async (_, command) => {
      await invalidate(command.templateKey, command.locale);
    },
  });
}

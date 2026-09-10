export type EmailTemplateContentField = "subject" | "text" | "html";

export type EmailTemplateVariableDefinition = {
  name: string;
  requiredIn: readonly EmailTemplateContentField[];
};

export type EmailTemplateEditorDefinition = {
  variables: readonly EmailTemplateVariableDefinition[];
};

const EMAIL_TEMPLATE_EDITOR_DEFINITIONS: Readonly<
  Record<string, EmailTemplateEditorDefinition>
> = {
  "tenant-owner-invitation": {
    variables: [
      { name: "tenantDisplayName", requiredIn: [] },
      { name: "invitationUrl", requiredIn: ["text", "html"] },
      { name: "expiresAt", requiredIn: ["text", "html"] },
    ],
  },
};

export function getEmailTemplateEditorDefinition(
  templateKey: string,
): EmailTemplateEditorDefinition | null {
  return EMAIL_TEMPLATE_EDITOR_DEFINITIONS[templateKey] ?? null;
}

export type InterpolationValues = Record<string, string | number>;

export type Translate = (
  key: string,
  options?: InterpolationValues,
) => string;

export type ValidationMessages = {
  email: (field: string) => string;
  invalid: (field: string) => string;
  integer: (field: string) => string;
  length: (field: string, length: number) => string;
  maxLength: (field: string, max: number) => string;
  maxNumber: (field: string, max: number) => string;
  minLength: (field: string, min: number) => string;
  minNumber: (field: string, min: number) => string;
  nonnegative: (field: string) => string;
  pattern: (field: string) => string;
  positive: (field: string) => string;
  required: (field: string) => string;
  selectionRequired: (field: string) => string;
  url: (field: string) => string;
  uuid: (field: string) => string;
};

export function createValidationMessages(
  t: Translate,
): ValidationMessages {
  return {
    required: (field) => t("required", { field }),
    selectionRequired: (field) => t("selectionRequired", { field }),
    email: (field) => t("email", { field }),
    invalid: (field) => t("invalid", { field }),
    minLength: (field, min) => t("minLength", { field, min }),
    maxLength: (field, max) => t("maxLength", { field, max }),
    length: (field, length) => t("length", { field, length }),
    url: (field) => t("url", { field }),
    uuid: (field) => t("uuid", { field }),
    pattern: (field) => t("pattern", { field }),
    minNumber: (field, min) => t("minNumber", { field, min }),
    maxNumber: (field, max) => t("maxNumber", { field, max }),
    positive: (field) => t("positive", { field }),
    nonnegative: (field) => t("nonnegative", { field }),
    integer: (field) => t("integer", { field }),
  };
}

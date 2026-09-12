import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enBranches from "./locales/en/branches.json";
import enCommon from "./locales/en/common.json";
import enEmailTemplates from "./locales/en/email-templates.json";
import enPatients from "./locales/en/patients.json";
import enPlans from "./locales/en/plans.json";
import enServices from "./locales/en/services.json";
import enValidation from "./locales/en/validation.json";
import enTenants from "./locales/en/tenants.json";
import enInvitations from "./locales/en/invitations.json";
import enStaff from "./locales/en/staff.json";
import viBranches from "./locales/vi/branches.json";
import viCommon from "./locales/vi/common.json";
import viEmailTemplates from "./locales/vi/email-templates.json";
import viPatients from "./locales/vi/patients.json";
import viPlans from "./locales/vi/plans.json";
import viServices from "./locales/vi/services.json";
import viValidation from "./locales/vi/validation.json";
import viTenants from "./locales/vi/tenants.json";
import viInvitations from "./locales/vi/invitations.json";
import viStaff from "./locales/vi/staff.json";

export const supportedLanguages = ["vi", "en"] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "vi",
    supportedLngs: supportedLanguages,
    load: "languageOnly",
    ns: [
      "branches",
      "common",
      "emailTemplates",
      "invitations",
      "patients",
      "plans",
      "services",
      "staff",
      "tenants",
      "validation",
    ],
    defaultNS: "common",
    resources: {
      en: {
        branches: enBranches,
        common: enCommon,
        emailTemplates: enEmailTemplates,
        invitations: enInvitations,
        patients: enPatients,
        plans: enPlans,
        services: enServices,
        staff: enStaff,
        tenants: enTenants,
        validation: enValidation,
      },
      vi: {
        branches: viBranches,
        common: viCommon,
        emailTemplates: viEmailTemplates,
        invitations: viInvitations,
        patients: viPatients,
        plans: viPlans,
        services: viServices,
        staff: viStaff,
        tenants: viTenants,
        validation: viValidation,
      },
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

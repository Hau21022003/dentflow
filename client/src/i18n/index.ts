import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enBranches from "./locales/en/branches.json";
import enAppointments from "./locales/en/appointments.json";
import enCommon from "./locales/en/common.json";
import enEmailTemplates from "./locales/en/email-templates.json";
import enPatients from "./locales/en/patients.json";
import enPlans from "./locales/en/plans.json";
import enProfile from "./locales/en/profile.json";
import enServiceGroups from "./locales/en/service-groups.json";
import enServices from "./locales/en/services.json";
import enValidation from "./locales/en/validation.json";
import enTenants from "./locales/en/tenants.json";
import enInvitations from "./locales/en/invitations.json";
import enStaff from "./locales/en/staff.json";
import enVisits from "./locales/en/visits.json";
import viBranches from "./locales/vi/branches.json";
import viAppointments from "./locales/vi/appointments.json";
import viCommon from "./locales/vi/common.json";
import viEmailTemplates from "./locales/vi/email-templates.json";
import viPatients from "./locales/vi/patients.json";
import viPlans from "./locales/vi/plans.json";
import viProfile from "./locales/vi/profile.json";
import viServiceGroups from "./locales/vi/service-groups.json";
import viServices from "./locales/vi/services.json";
import viValidation from "./locales/vi/validation.json";
import viTenants from "./locales/vi/tenants.json";
import viInvitations from "./locales/vi/invitations.json";
import viStaff from "./locales/vi/staff.json";
import viVisits from "./locales/vi/visits.json";

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
      "appointments",
      "common",
      "emailTemplates",
      "invitations",
      "patients",
      "plans",
      "profile",
      "serviceGroups",
      "services",
      "staff",
      "tenants",
      "validation",
      "visits",
    ],
    defaultNS: "common",
    resources: {
      en: {
        branches: enBranches,
        appointments: enAppointments,
        common: enCommon,
        emailTemplates: enEmailTemplates,
        invitations: enInvitations,
        patients: enPatients,
        plans: enPlans,
        profile: enProfile,
        serviceGroups: enServiceGroups,
        services: enServices,
        staff: enStaff,
        tenants: enTenants,
        validation: enValidation,
        visits: enVisits,
      },
      vi: {
        branches: viBranches,
        appointments: viAppointments,
        common: viCommon,
        emailTemplates: viEmailTemplates,
        invitations: viInvitations,
        patients: viPatients,
        plans: viPlans,
        profile: viProfile,
        serviceGroups: viServiceGroups,
        services: viServices,
        staff: viStaff,
        tenants: viTenants,
        validation: viValidation,
        visits: viVisits,
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

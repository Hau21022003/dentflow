import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enPatients from "./locales/en/patients.json";
import enPlans from "./locales/en/plans.json";
import enValidation from "./locales/en/validation.json";
import viCommon from "./locales/vi/common.json";
import viPatients from "./locales/vi/patients.json";
import viPlans from "./locales/vi/plans.json";
import viValidation from "./locales/vi/validation.json";

export const supportedLanguages = ["vi", "en"] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "vi",
    supportedLngs: supportedLanguages,
    load: "languageOnly",
    ns: ["common", "patients", "plans", "validation"],
    defaultNS: "common",
    resources: {
      en: {
        common: enCommon,
        patients: enPatients,
        plans: enPlans,
        validation: enValidation,
      },
      vi: {
        common: viCommon,
        patients: viPatients,
        plans: viPlans,
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

import { useEffect, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { AuthSessionBootstrap } from "./AuthSessionBootstrap";
import { ReactQueryProvider } from "./ReactQueryProvider";

export function AppProviders({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <ReactQueryProvider>
      <AuthSessionBootstrap />
      {children}
    </ReactQueryProvider>
  );
}

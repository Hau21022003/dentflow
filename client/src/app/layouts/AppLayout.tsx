import { Languages, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { PATHS } from "../router/paths";

export function AppLayout() {
  const { i18n, t } = useTranslation("common");
  const language = i18n.resolvedLanguage === "en" ? "en" : "vi";

  function toggleLanguage() {
    void i18n.changeLanguage(language === "vi" ? "en" : "vi");
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link className="flex items-center gap-2.5 text-foreground" to={PATHS.patients}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Stethoscope aria-hidden="true" className="size-5" />
            </span>
            <span className="text-base font-bold tracking-tight">DentFlow</span>
          </Link>

          <nav aria-label="Điều hướng chính" className="ml-4 hidden items-center gap-1 sm:flex">
            <NavLink
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
              to={PATHS.patients}
            >
              {t("navigation.patients")}
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild className="hidden sm:inline-flex" size="sm" variant="ghost">
              <Link to={PATHS.login}>{t("navigation.demoLogin")}</Link>
            </Button>
            <Button
              aria-label={
                language === "vi"
                  ? t("language.switchToEnglish")
                  : t("language.switchToVietnamese")
              }
              onClick={toggleLanguage}
              size="sm"
              type="button"
              variant="outline"
            >
              <Languages aria-hidden="true" />
              {language === "vi" ? "EN" : "VI"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

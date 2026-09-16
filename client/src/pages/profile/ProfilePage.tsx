import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authQueryKeys } from "@/features/auth/auth.hooks";
import { authService } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import type { AuthUser } from "@/features/auth/auth.types";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { getErrorMessage } from "@/shared/lib/error";
import { uploadUserTempImage } from "@/shared/lib/temp-image-upload";
import { LoaderCircle, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return null;
  }

  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { t } = useTranslation("profile");
  const setAuthenticatedUser = useAuthStore(
    (state) => state.setAuthenticatedUser,
  );
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const displayedAvatarUrl =
    previewUrl ?? (removeAvatar ? null : user.avatarUrl);

  function selectAvatar(file: File | null) {
    setSelectedFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setRemoveAvatar(false);
    setError(null);
    setSuccess(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setError(t("errors.nameRequired"));
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const upload = selectedFile
        ? await uploadUserTempImage({ file: selectedFile, folder: "AVATAR" })
        : null;
      const profile = await authService.updateMyProfile({
        fullName: normalizedName,
        ...(upload
          ? { avatarObjectKey: upload.objectKey }
          : removeAvatar
            ? { avatarObjectKey: null }
            : {}),
      });
      const updatedUser = {
        ...user,
        ...profile,
        authorization: user.authorization,
      };
      setAuthenticatedUser(updatedUser);
      queryClient.setQueryData(authQueryKeys.me(), updatedUser);
      setSelectedFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      setSuccess(true);

      try {
        const refreshedUser = await authService.getMe();
        setAuthenticatedUser(refreshedUser);
        queryClient.setQueryData(authQueryKeys.me(), refreshedUser);
      } catch {
        // The profile response is already safe to display; the next session
        // bootstrap will obtain a freshly signed avatar URL.
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {t("description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.title")}</CardTitle>
          <CardDescription>{t("form.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6" onSubmit={(event) => void submit(event)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar
                avatarUrl={displayedAvatarUrl}
                className="size-20 text-lg"
                fullName={fullName || user.fullName}
              />
              <div className="grid gap-2">
                <Label htmlFor="profile-avatar">{t("fields.avatar")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    accept="image/jpeg,image/png,image/webp"
                    className="max-w-72"
                    disabled={isSaving}
                    id="profile-avatar"
                    onChange={(event) =>
                      selectAvatar(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  {(displayedAvatarUrl || selectedFile) && (
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setRemoveAvatar(true);
                        setSuccess(false);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 aria-hidden="true" />
                      {t("actions.removeAvatar")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("avatarHint")}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-full-name">{t("fields.fullName")}</Label>
              <Input
                disabled={isSaving}
                id="profile-full-name"
                maxLength={150}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setSuccess(false);
                }}
                required
                value={fullName}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-email">{t("fields.email")}</Label>
              <Input
                disabled
                id="profile-email"
                type="email"
                value={user.email}
              />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-700" role="status">
                {t("success")}
              </p>
            )}

            <div className="flex justify-end">
              <Button disabled={isSaving} type="submit">
                {isSaving ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {isSaving ? t("actions.saving") : t("actions.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

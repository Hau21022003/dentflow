import { useState } from "react";
import { cn } from "@/shared/lib/utils";

function userInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const first = words[0]?.slice(0, 1) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.slice(0, 1) ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

type UserAvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  fullName: string;
};

export function UserAvatar({
  avatarUrl,
  className,
  fullName,
}: UserAvatarProps) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  return (
    <span
      aria-label={fullName}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground",
        className,
      )}
    >
      {avatarUrl && failedAvatarUrl !== avatarUrl ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedAvatarUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : (
        userInitials(fullName)
      )}
    </span>
  );
}

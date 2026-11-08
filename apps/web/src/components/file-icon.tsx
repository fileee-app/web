import { cn } from "@fileee/ui/lib/utils";
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon as GenericIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import { useState } from "react";

/** The MIME type is only a browser hint, which is fine for choosing an icon. */
export function FileIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
  const type = mimeType ?? "";

  const [Icon, color] = type.startsWith("image/")
    ? [FileImageIcon, "text-emerald-500"]
    : type.startsWith("video/")
      ? [FileVideoIcon, "text-violet-500"]
      : type.startsWith("audio/")
        ? [FileAudioIcon, "text-pink-500"]
        : type === "application/pdf"
          ? [FileTextIcon, "text-red-500"]
          : type.startsWith("text/")
            ? [FileTextIcon, "text-blue-500"]
            : /json|xml|javascript/.test(type)
              ? [FileCodeIcon, "text-amber-500"]
              : /zip|tar|compressed|rar/.test(type)
                ? [FileArchiveIcon, "text-orange-500"]
                : [GenericIcon, undefined];

  // Last, so the type's colour wins over a caller's text-muted-foreground.
  return <Icon className={cn(className, color)} />;
}

/** The thumbnail from the bucket, or the type's icon if there's none or it won't load. */
export function FileThumb({
  file,
  thumbClassName,
  iconClassName,
}: {
  file: { mimeType: string | null; thumbnailUrl: string | null };
  thumbClassName: string;
  iconClassName: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!file.thumbnailUrl || failed === file.thumbnailUrl) {
    return <FileIcon mimeType={file.mimeType} className={iconClassName} />;
  }

  return (
    <img
      src={file.thumbnailUrl}
      alt=""
      loading="lazy"
      draggable={false}
      className={thumbClassName}
      onError={() => setFailed(file.thumbnailUrl)}
    />
  );
}

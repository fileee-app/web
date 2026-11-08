import { Button } from "@fileee/ui/components/button";
import { Spinner } from "@fileee/ui/components/spinner";
import { DownloadIcon } from "lucide-react";
import { type SharedFile } from "./queries.ts";

export function DownloadButton({
  file,
  className,
  saving,
  save,
}: {
  file: SharedFile;
  className?: string;
  saving: (file: SharedFile) => boolean;
  save: (file: SharedFile) => void;
}) {
  return (
    <Button className={className} disabled={saving(file)} onClick={() => save(file)}>
      {saving(file) ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <DownloadIcon data-icon="inline-start" />
      )}
      Download
    </Button>
  );
}

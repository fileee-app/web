import { Button } from "@fileee/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@fileee/ui/components/dropdown-menu";
import { UploadIcon, FolderUpIcon } from "lucide-react";

export function UploadMenu({
  onPickFiles,
  onPickFolder,
}: {
  onPickFiles: () => void;
  onPickFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <UploadIcon data-icon="inline-start" />
        Upload
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onPickFiles}>
          <UploadIcon />
          Files
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onPickFolder}>
          <FolderUpIcon />
          Folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

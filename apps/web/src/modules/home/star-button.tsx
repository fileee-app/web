import { Button } from "@fileee/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { orpc } from "../../lib/orpc.ts";

export function StarButton({
  fileId,
  name,
  starred,
}: {
  fileId: string;
  name: string;
  starred: boolean;
}) {
  const queryClient = useQueryClient();

  const star = useMutation(
    orpc.file.star.mutationOptions({
      onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.file.key() }),
    }),
  );

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-pressed={starred}
      aria-label={starred ? `Unstar ${name}` : `Star ${name}`}
      disabled={star.isPending}
      onClick={() => star.mutate({ fileId, starred: !starred })}
    >
      <StarIcon className={starred ? "fill-current" : ""} />
    </Button>
  );
}

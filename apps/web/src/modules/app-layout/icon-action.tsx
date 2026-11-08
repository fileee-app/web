import { Button } from "@fileee/ui/components/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@fileee/ui/components/tooltip";

export function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon-sm" variant="ghost" onClick={onClick} aria-label={label} />}
      >
        {children}
      </TooltipTrigger>

      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

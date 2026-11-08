import { Button } from "@fileee/ui/components/button";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

export function ConnectStorageButton() {
  return (
    <Button size="sm" nativeButton={false} render={<Link to="/settings/storages/new" />}>
      <PlusIcon data-icon="inline-start" />
      Connect storage
    </Button>
  );
}

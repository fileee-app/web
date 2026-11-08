import { Button } from "@fileee/ui/components/button";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { orpc } from "../../../lib/orpc.ts";
import { CreateUserDialog } from "./create-user-dialog.tsx";
import { DeleteUserDialog } from "./delete-user-dialog.tsx";
import { ResetPasswordDialog } from "./reset-password-dialog.tsx";
import { UsersTable } from "./users-table.tsx";

const route = getRouteApi("/_app/settings/users");

export function UsersPage() {
  const { data: users } = useSuspenseQuery(orpc.user.list.queryOptions());
  const { user: me } = route.useRouteContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<(typeof users)[number] | null>(null);
  const [deleteFor, setDeleteFor] = useState<(typeof users)[number] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.user.key() });
  const setDisabled = useMutation(orpc.user.setDisabled.mutationOptions({ onSuccess: refresh }));

  const remove = useMutation(
    orpc.user.remove.mutationOptions({
      onSuccess: refresh,
      onSettled: () => setDeleteFor(null),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Users</h2>

          <p className="text-sm text-muted-foreground">
            Admins manage accounts, and can't see other users' files.
          </p>
        </div>

        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Add user
        </Button>
      </div>

      <UsersTable
        users={users}
        meId={me.id}
        onReset={setResetFor}
        onDelete={setDeleteFor}
        onSetDisabled={(change) => setDisabled.mutate(change)}
      />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />

      <DeleteUserDialog
        user={deleteFor}
        onClose={() => setDeleteFor(null)}
        onConfirm={(userId) => remove.mutate({ userId })}
      />
    </div>
  );
}

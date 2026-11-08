import { Button } from "@fileee/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@fileee/ui/components/card";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { orpc } from "../../../../lib/orpc.ts";
import { StorageCheck } from "../storage-check.tsx";
import { StorageForm, EMPTY_STORAGE } from "../storage-form.tsx";

export function NewStoragePage() {
  const queryClient = useQueryClient();
  const [storageId, setStorageId] = useState<string>();

  const create = useMutation(
    orpc.storage.create.mutationOptions({
      onSuccess: async (storage) => {
        await queryClient.invalidateQueries({ queryKey: orpc.storage.key() });
        setStorageId(storage.id);
      },
    }),
  );

  if (storageId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check the connection</CardTitle>

          <CardDescription>
            Saved, and your existing files are being imported. Run both checks so that a problem
            shows up here, not mid-upload.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <StorageCheck storageId={storageId} />

          <Button
            className="self-end"
            nativeButton={false}
            render={<Link to="/s/$storageId/$" params={{ storageId, _splat: "" }} />}
          >
            Open storage
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect storage</CardTitle>

        <CardDescription>
          Your files stay in your bucket. fileee keeps only folder names and encrypted credentials.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <StorageForm
          initial={EMPTY_STORAGE}
          submitLabel="Connect"
          onSubmit={(values) => create.mutateAsync(values).catch(() => {})}
        />
      </CardContent>
    </Card>
  );
}

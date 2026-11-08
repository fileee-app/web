import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "../../components/auth-layout.tsx";
import { orpc } from "../../lib/orpc.ts";
import { PasswordForm } from "./password-form.tsx";
import { resolveOptions, type Resolved, type SharedFile } from "./queries.ts";
import { SharedFileView } from "./shared-file-view.tsx";
import { SharedFolderView } from "./shared-folder-view.tsx";

const route = getRouteApi("/share/$token");

export function SharePage() {
  const { token } = route.useParams();
  const { status } = route.useRouteContext();
  const { data: first } = useSuspenseQuery(resolveOptions(token));
  // Kept in memory only, and sent with each request. A reload asks again.
  const [password, setPassword] = useState<string>();
  const [opened, setOpened] = useState<Resolved | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [previewing, setPreviewing] = useState<SharedFile | null>(null);

  const resolve = useMutation(orpc.share.resolve.mutationOptions());

  const download = useMutation(
    orpc.share.download.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url), // its Content-Disposition keeps us on this page
    }),
  );

  const view = opened ?? first;

  const unlock = async (entered: string) => {
    setOpened(await resolve.mutateAsync({ token, password: entered }));
    setPassword(entered);
  };

  const browse = (next: { id: string; name: string }[]) =>
    resolve.mutate(
      { token, password, folderId: next.at(-1)?.id },
      {
        onSuccess: (result) => {
          setOpened(result);
          setTrail(next);
        },
      },
    );

  const save = (file: SharedFile) => download.mutate({ token, password, fileId: file.id });
  const saving = (file: SharedFile) => download.isPending && download.variables.fileId === file.id;
  const fileProps = { token, password, saving, save };

  return (
    <AuthLayout appName={status.appName}>
      {view.needsPassword ? (
        <PasswordForm onSubmit={unlock} />
      ) : view.kind === "file" ? (
        <SharedFileView {...fileProps} file={view.file} />
      ) : previewing ? (
        <SharedFileView {...fileProps} file={previewing} onBack={() => setPreviewing(null)} />
      ) : (
        <SharedFolderView
          view={view}
          trail={trail}
          busy={resolve.isPending}
          browse={browse}
          onPreview={setPreviewing}
          saving={saving}
          save={save}
        />
      )}
    </AuthLayout>
  );
}

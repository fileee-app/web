import { Alert, AlertDescription, AlertTitle } from "@fileee/ui/components/alert";
import { Button } from "@fileee/ui/components/button";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@fileee/ui/components/item";
import { Spinner } from "@fileee/ui/components/spinner";
import { Textarea } from "@fileee/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ClipboardIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { client, orpc } from "../../../lib/orpc.ts";

/** A PUT from this page to the bucket: the only real proof that its CORS rule allows this origin. */
async function browserCorsTest(storageId: string) {
  const { probeUrl } = await client.storage.corsInfo({ storageId });
  const res = await fetch(probeUrl, { method: "PUT", body: "fileee cors probe" }).catch(() => null);

  if (!res) {
    throw new Error(
      "The browser was blocked from reaching the bucket, so its CORS rule doesn't allow this site yet.",
    );
  }

  if (!res.ok) throw new Error(`The bucket answered HTTP ${res.status}.`);
}

/** The guided check: a server-side round trip, then CORS from this browser. */
export function StorageCheck({ storageId }: { storageId: string }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.storage.key() });
  const test = useMutation(orpc.storage.test.mutationOptions({ onSuccess: refresh }));
  const cors = useMutation({ mutationFn: () => browserCorsTest(storageId) });

  const apply = useMutation(
    orpc.storage.applyCors.mutationOptions({
      onSuccess: () => {
        toast.success("CORS rule applied.");
        cors.mutate();
      },
    }),
  );

  const guide = useMutation(orpc.storage.corsInfo.mutationOptions());

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium">Connection</h3>

            <p className="text-sm text-muted-foreground">
              Writes, reads and deletes a small test object under your prefix.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={test.isPending}
            onClick={() => test.mutate({ storageId })}
          >
            {test.isPending && <Spinner data-icon="inline-start" />}
            Run test
          </Button>
        </div>

        {test.data && (
          <ItemGroup>
            {test.data.steps.map((step) => (
              <Item key={step.step} size="xs" className="px-0">
                <ItemMedia>
                  {step.ok ? (
                    <CheckCircle2Icon className="size-4 text-muted-foreground" />
                  ) : (
                    <XCircleIcon className="size-4 text-destructive" />
                  )}
                </ItemMedia>

                <ItemContent>
                  <ItemTitle className="capitalize">{step.step}</ItemTitle>

                  {step.error && (
                    <ItemDescription className="line-clamp-none text-destructive">
                      {step.error}
                    </ItemDescription>
                  )}

                  {step.fix && (
                    <ItemDescription className="line-clamp-none">{step.fix}</ItemDescription>
                  )}
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">Browser access (CORS)</h3>

            <p className="text-sm text-muted-foreground">
              Uploads go straight from your browser to the bucket, so it must allow this site.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={guide.isPending}
              onClick={() => guide.mutate({ storageId })}
            >
              How to set up
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={apply.isPending}
              onClick={() => apply.mutate({ storageId })}
            >
              {apply.isPending && <Spinner data-icon="inline-start" />}
              Apply for me
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={cors.isPending}
              onClick={() => cors.mutate()}
            >
              {cors.isPending && <Spinner data-icon="inline-start" />}
              Test
            </Button>
          </div>
        </div>

        {guide.data && (
          <div className="flex flex-col gap-4">
            {[
              {
                label: "IAM policy",
                text: "Limit the access key to this bucket. Some providers, such as Tigris, need this IAM policy attached to the key. The CORS actions are only needed for Apply for me, and a separate public bucket needs the same access.",
                value: JSON.stringify(guide.data.policy, null, 2),
              },
              {
                label: "CORS rule",
                text: "Add this rule to the bucket so this site can reach it, or use Apply for me.",
                value: JSON.stringify([guide.data.rule], null, 2),
              },
            ].map(({ label, text, value }) => (
              <div key={label} className="flex flex-col gap-2">
                <div>
                  <h4 className="text-sm font-medium">{label}</h4>

                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>

                <div className="relative">
                  <Textarea
                    readOnly
                    rows={10}
                    aria-label={label}
                    className="font-mono text-xs"
                    value={value}
                  />

                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Copy ${label}`}
                    className="absolute top-2 right-2"
                    onClick={() => {
                      void navigator.clipboard.writeText(value);
                      toast.success("Copied.");
                    }}
                  >
                    <ClipboardIcon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cors.isSuccess && (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>This browser can upload to the bucket.</AlertTitle>
          </Alert>
        )}

        {cors.error && (
          <Alert variant="destructive">
            <XCircleIcon />
            <AlertTitle>CORS check failed</AlertTitle>
            <AlertDescription>{cors.error.message}</AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}

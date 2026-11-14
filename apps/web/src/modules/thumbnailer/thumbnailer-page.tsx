import { useEffect } from "react";
import { extractForApp } from "../../lib/extract.ts";

declare global {
  interface Window {
    /** The bridge NSH's web view gives a page: present only inside the desktop and mobile apps. */
    nsh?: { postMessage(data: string): void };
  }
}

interface Job {
  id: number;
  kind: Parameters<typeof extractForApp>[0];
  url: string;
  size: number;
}

/**
 * Loaded by the desktop and mobile apps in a hidden web view, to use this browser's decoders (pdf.js,
 * <video>). Being on the app's origin is what lets it read the bucket under its CORS rule. It holds no
 * session and calls no API: the app sends it a presigned URL and stores what comes back.
 */
export function ThumbnailerPage() {
  useEffect(() => {
    const bridge = window.nsh;

    if (!bridge) return;

    // NSH's bridge to the app, not window.postMessage: it takes no target origin.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    const reply = (message: object) => bridge.postMessage(JSON.stringify(message));

    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;

      const job = JSON.parse(e.data) as Job;

      extractForApp(job.kind, job.url, job.size).then(
        (result) => reply({ id: job.id, ...result }),
        (error: unknown) =>
          reply({ id: job.id, error: error instanceof Error ? error.message : String(error) }),
      );
    };

    window.addEventListener("message", onMessage);
    reply({ ready: true });

    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <p className="p-6 text-sm text-muted-foreground">
      This page makes previews for the Fileee app.
    </p>
  );
}

import appCss from "@fileee/ui/globals.css?url";
import { Toaster } from "@fileee/ui/components/sonner";
import { TooltipProvider } from "@fileee/ui/components/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { orpc } from "../lib/orpc.ts";
import { themeScript, useTheme } from "../lib/theme.ts";

// Buckets and CDNs can be on any host, so files load from anywhere. Script is what this locks down.
const csp = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "media-src 'self' blob: http: https:",
    "connect-src 'self' http: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; nonce?: string }>()({
  beforeLoad: async ({ context, location }) => {
    const status = await context.queryClient.fetchQuery(orpc.setup.status.queryOptions());

    if (!status.complete && location.pathname !== "/setup") throw redirect({ to: "/setup" });

    return { status };
  },
  loader: ({ context }) => ({ appName: context.status.appName }),
  headers: ({ match: { context } }) => ({
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    ...(context.nonce && { "Content-Security-Policy": csp(context.nonce) }),
  }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: loaderData?.appName ?? "Fileee" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Generated from the sidebar's logo badge; favicon.svg switches colors itself, PNGs need media queries.
      { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      ...(["light", "dark"] as const).flatMap((mode) =>
        [16, 32].map((size) => ({
          rel: "icon",
          type: "image/png",
          sizes: `${size}x${size}`,
          href: `/favicon-${size}-${mode}.png`,
          media: `(prefers-color-scheme: ${mode})`,
        })),
      ),
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [{ children: themeScript }],
  }),
  component: Root,
});

function Root() {
  const { mode } = useTheme();

  return (
    // The theme script sets <html>'s class and data-accent before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>

      <body>
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>

        <Toaster position="top-center" theme={mode} />
        <Scripts />
      </body>
    </html>
  );
}

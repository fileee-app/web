import type { AnyRouteMatch } from "@tanstack/react-router";

/** `Trash | Fileee`. The root route's loader supplies the app name. */
export function pageTitle(page: string, matches: AnyRouteMatch[]) {
  const appName = (matches[0]?.loaderData as { appName?: string } | undefined)?.appName ?? "Fileee";

  return { meta: [{ title: `${page} | ${appName}` }] };
}

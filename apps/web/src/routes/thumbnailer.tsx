import { createFileRoute } from "@tanstack/react-router";
import { ThumbnailerPage } from "../modules/thumbnailer/thumbnailer-page.tsx";

// For the desktop and mobile apps' hidden web view; see the page.
export const Route = createFileRoute("/thumbnailer")({
  headers: () => ({ "X-Robots-Tag": "noindex" }),
  head: () => ({ meta: [{ title: "Thumbnailer" }, { name: "robots", content: "noindex" }] }),
  component: ThumbnailerPage,
});

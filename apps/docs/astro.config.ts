import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    // Has to run before Starlight to see the mermaid code blocks.
    mermaid({ autoTheme: true }),
    starlight({
      title: "Fileee",
      logo: { src: "./src/assets/logo.svg" },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/fileee-app/web" }],
      sidebar: [
        { label: "Get started", items: ["introduction", "installing"] },
        { label: "Use", items: ["using", "sharing"] },
        {
          label: "Storage providers",
          items: [
            { label: "Overview", slug: "providers" },
            "providers/aws-s3",
            "providers/cloudflare-r2",
            "providers/backblaze-b2",
            "providers/wasabi",
            "providers/tigris",
            "providers/digitalocean-spaces",
            "providers/minio",
            "providers/s3-compatible",
          ],
        },
        { label: "Run", items: ["deploying", "administering", "security", "troubleshooting"] },
        { label: "Reference", items: ["how-it-works", "app-api", "developing", "changelog"] },
      ],
    }),
  ],
});

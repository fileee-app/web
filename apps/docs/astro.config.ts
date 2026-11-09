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
        "installing",
        "deploying",
        "how-it-works",
        "security",
        "troubleshooting",
        "developing",
      ],
    }),
  ],
});

import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

export default defineConfig({
  site: "https://tonyblu331.github.io",
  base: "/threejs-debug-compose",
  integrations: [
    starlight({
      title: "threejs-debug-compose",
      description: "Composable TSL debug views for Three.js WebGPU render pipelines.",
      editLink: {
        baseUrl: "https://github.com/tonyblu331/threejs-debug-compose/edit/master/packages/docs/",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tonyblu331/threejs-debug-compose",
        },
      ],
      sidebar: [
        {
          label: "Start Here",
          items: ["index", "guides/quick-start", "guides/render-modes"],
        },
        {
          label: "Debug Views",
          items: [
            "guides/built-in-views",
            "guides/custom-debug-views",
            "guides/shader-cost-heatmap",
            "guides/viewport-labels",
          ],
        },
        {
          label: "Reference",
          items: ["reference/api", "reference/deployment"],
        },
      ],
    }),
  ],
})

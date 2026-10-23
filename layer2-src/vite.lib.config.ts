import path from "path"
import { defineConfig } from "vite"

// Second build (npm run build): the Partner Finder engine as a small IIFE for
// the plain-JS Verdict page (verdict-flow.js loads /pf-recommend.js lazily).
// Written straight into the site folder; layer2-verify checks it like the
// module bundles.
export default defineConfig({
  publicDir: false,
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: path.resolve(__dirname, "../Kimi_Agent_Virtuse%20MiCA%20Partners"),
    emptyOutDir: false,
    copyPublicDir: false,
    minify: true,
    lib: {
      entry: path.resolve(__dirname, "src/lib/pf-public.ts"),
      name: "VBPartners",
      formats: ["iife"],
      fileName: () => "pf-recommend.js",
    },
  },
});

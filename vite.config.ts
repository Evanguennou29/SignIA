import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: "frontend",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "signia-production-privacy",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  ],
  build: { outDir: "../dist", emptyOutDir: true },
  worker: { format: "es" },
});

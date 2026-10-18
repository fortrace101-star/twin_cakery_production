import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The website reads the public catalogue from the Express ERP (see
// src/lib/catalogue-api.ts). Point it elsewhere with VITE_ERP_API_URL.
const ERP_API_URL = "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    proxy: {
      "/api/v1": { target: ERP_API_URL, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api/v1": { target: ERP_API_URL, changeOrigin: true },
    },
  },
});
